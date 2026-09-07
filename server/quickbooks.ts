import crypto from "crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  quickbooksConnections,
  quickbooksOAuthStates,
  quickbooksSyncRuns,
  quickbooksTransactions,
  type QuickbooksConnection,
} from "../drizzle/schema";
import { getDb } from "./db";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";

const OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const OAUTH_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const OAUTH_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const DEFAULT_REDIRECT_URI = "https://afropuppyyoga.ca/api/integrations/quickbooks/callback";
const DEFAULT_GRAPH_MINOR_VERSION = "75";
const DAILY_SYNC_CRON = "0 0 12 * * *";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_EARLY_MS = 2 * 60 * 1000;

type QboTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
};

export type QuickbooksNormalizedTransaction = {
  sourceType: string;
  sourceTransactionId: string;
  transactionDate: string;
  direction: "expense" | "income" | "transfer" | "other";
  amountCents: number;
  currency: string;
  categoryName: string | null;
  accountName: string | null;
  payeeName: string | null;
  description: string | null;
  sourceUpdatedAt: Date | null;
};

function requireQuickbooksCredentials() {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("QuickBooks Online credentials are not configured");
  return { clientId, clientSecret };
}

function redirectUri() {
  return process.env.QBO_REDIRECT_URI || DEFAULT_REDIRECT_URI;
}

function qboApiBase() {
  return process.env.QBO_ENVIRONMENT === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET || process.env.SCHEDULED_JOB_SECRET;
  if (!secret) throw new Error("Server encryption key is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptQuickbooksSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptQuickbooksSecret(ciphertext: string) {
  const [ivPart, tagPart, valuePart] = ciphertext.split(".");
  if (!ivPart || !tagPart || !valuePart) throw new Error("QuickBooks token storage is invalid");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(valuePart, "base64url")), decipher.final()]).toString("utf8");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cleanText(value: unknown, length = 255): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, length) : null;
}

function moneyToCents(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function getFirstExpenseCategory(item: Record<string, any>): string | null {
  const firstLine = Array.isArray(item.Line) ? item.Line[0] : undefined;
  return cleanText(
    firstLine?.AccountBasedExpenseLineDetail?.AccountRef?.name
    ?? firstLine?.ItemBasedExpenseLineDetail?.ItemRef?.name
    ?? firstLine?.AccountRef?.name,
  );
}

function safeDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeQuickbooksEntity(sourceType: string, item: Record<string, any>): QuickbooksNormalizedTransaction | null {
  const id = cleanText(item.Id, 100);
  const transactionDate = cleanText(item.TxnDate, 10);
  if (!id || !transactionDate) return null;

  const lowerType = sourceType.toLowerCase();
  const direction = lowerType === "deposit"
    ? "income"
    : lowerType === "transfer"
      ? "transfer"
      : ["purchase", "bill", "check", "billpayment"].includes(lowerType)
        ? "expense"
        : "other";
  const description = cleanText(item.PrivateNote ?? item.DocNumber, 10_000);
  const payeeName = cleanText(item.EntityRef?.name ?? item.VendorRef?.name ?? item.CustomerRef?.name);
  const accountName = cleanText(item.AccountRef?.name ?? item.DepositToAccountRef?.name ?? item.CashBack?.AccountRef?.name);
  const categoryName = getFirstExpenseCategory(item)
    ?? cleanText(item.Deposit?.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.name)
    ?? accountName;

  return {
    sourceType,
    sourceTransactionId: id,
    transactionDate,
    direction,
    amountCents: moneyToCents(item.TotalAmt),
    currency: cleanText(item.CurrencyRef?.value, 8) ?? "CAD",
    categoryName,
    accountName,
    payeeName,
    description,
    sourceUpdatedAt: safeDate(item.MetaData?.LastUpdatedTime),
  };
}

async function postToken(body: URLSearchParams): Promise<QboTokenResponse> {
  const { clientId, clientSecret } = requireQuickbooksCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({})) as Partial<QboTokenResponse> & { error?: string };
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(`QuickBooks authorization failed${payload.error ? `: ${payload.error}` : ""}`);
  }
  return payload as QboTokenResponse;
}

async function revokeQuickbooksRefreshToken(connection: QuickbooksConnection) {
  const { clientId, clientSecret } = requireQuickbooksCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(OAUTH_REVOKE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: decryptQuickbooksSecret(connection.refreshTokenCiphertext) }),
  });
  if (!response.ok) throw new Error("QuickBooks could not confirm access revocation");
}

async function refreshQuickbooksConnection(connection: QuickbooksConnection) {
  const response = await postToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptQuickbooksSecret(connection.refreshTokenCiphertext),
  }));
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const tokenExpiresAt = new Date(now + response.expires_in * 1000);
  const refreshTokenExpiresAt = response.x_refresh_token_expires_in
    ? new Date(now + response.x_refresh_token_expires_in * 1000)
    : connection.refreshTokenExpiresAt;
  await db.update(quickbooksConnections).set({
    accessTokenCiphertext: encryptQuickbooksSecret(response.access_token),
    refreshTokenCiphertext: encryptQuickbooksSecret(response.refresh_token),
    tokenExpiresAt,
    refreshTokenExpiresAt,
    updatedAt: new Date(),
  }).where(eq(quickbooksConnections.id, connection.id));
  return { ...connection, accessTokenCiphertext: encryptQuickbooksSecret(response.access_token), tokenExpiresAt };
}

async function getAccessToken(connection: QuickbooksConnection) {
  if (connection.tokenExpiresAt.getTime() <= Date.now() + REFRESH_EARLY_MS) {
    const refreshed = await refreshQuickbooksConnection(connection);
    return decryptQuickbooksSecret(refreshed.accessTokenCiphertext);
  }
  return decryptQuickbooksSecret(connection.accessTokenCiphertext);
}

async function fetchQboJson<T>(connection: QuickbooksConnection, path: string) {
  const accessToken = await getAccessToken(connection);
  const response = await fetch(`${qboApiBase()}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({})) as T & { Fault?: { Error?: Array<{ Message?: string }> } };
  if (!response.ok || data.Fault) {
    const detail = data.Fault?.Error?.[0]?.Message;
    throw new Error(`QuickBooks read failed${detail ? `: ${detail}` : ` (HTTP ${response.status})`}`);
  }
  return data;
}

async function queryEntity(connection: QuickbooksConnection, entity: string, since: string) {
  const values: Record<string, any>[] = [];
  const pageSize = 1_000;
  for (let start = 1; start <= 5_000; start += pageSize) {
    const query = `SELECT * FROM ${entity} WHERE TxnDate >= '${since}' STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
    const data = await fetchQboJson<{ QueryResponse?: Record<string, Record<string, any>[]> }>(
      connection,
      `/v3/company/${encodeURIComponent(connection.realmId)}/query?query=${encodeURIComponent(query)}&minorversion=${DEFAULT_GRAPH_MINOR_VERSION}`,
    );
    const page = data.QueryResponse?.[entity] ?? [];
    values.push(...page);
    if (page.length < pageSize) break;
  }
  return values;
}

function initialOrOverlapDate(lastSyncAt: Date | null) {
  const base = lastSyncAt
    ? new Date(lastSyncAt.getTime() - 14 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  return base.toISOString().slice(0, 10);
}

async function latestConnection() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(quickbooksConnections)
    .where(eq(quickbooksConnections.isActive, true))
    .orderBy(desc(quickbooksConnections.updatedAt)).limit(1))[0] ?? null;
}

export async function startQuickbooksAuthorization() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { clientId } = requireQuickbooksCredentials();
  const state = crypto.randomBytes(32).toString("base64url");
  await db.insert(quickbooksOAuthStates).values({
    stateHash: sha256(state),
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
  });
  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

async function fetchCompanyName(connection: QuickbooksConnection): Promise<string | null> {
  try {
    const payload = await fetchQboJson<{ CompanyInfo?: { CompanyName?: string } }>(
      connection,
      `/v3/company/${encodeURIComponent(connection.realmId)}/companyinfo/${encodeURIComponent(connection.realmId)}?minorversion=${DEFAULT_GRAPH_MINOR_VERSION}`,
    );
    return cleanText(payload.CompanyInfo?.CompanyName);
  } catch {
    return null;
  }
}

async function ensureDailyQuickbooksSync(connectionId: number, existingTaskUid: string | null) {
  if (existingTaskUid) return existingTaskUid;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existingSchedule = (await db.select({ scheduleTaskUid: quickbooksConnections.scheduleTaskUid })
    .from(quickbooksConnections)
    .where(and(eq(quickbooksConnections.isActive, true), sql`${quickbooksConnections.scheduleTaskUid} IS NOT NULL`))
    .limit(1))[0]?.scheduleTaskUid;
  if (existingSchedule) {
    await db.update(quickbooksConnections).set({ scheduleTaskUid: existingSchedule }).where(eq(quickbooksConnections.id, connectionId));
    return existingSchedule;
  }
  const created = await createHeartbeatJob({
    name: "apy-quickbooks-daily-sync",
    cron: DAILY_SYNC_CRON,
    path: "/api/scheduled/quickbooks-sync",
    description: "Daily read-only QuickBooks Online import for the APY owner finance hub",
  }, "");
  await db.update(quickbooksConnections).set({ scheduleTaskUid: created.taskUid }).where(eq(quickbooksConnections.id, connectionId));
  return created.taskUid;
}

export async function completeQuickbooksAuthorization(code: string, state: string, realmId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const stateHash = sha256(state);
  const stateRecord = (await db.select().from(quickbooksOAuthStates)
    .where(and(eq(quickbooksOAuthStates.stateHash, stateHash), gt(quickbooksOAuthStates.expiresAt, new Date())))
    .limit(1))[0];
  if (!stateRecord) throw new Error("QuickBooks authorization has expired. Please start the connection again.");
  await db.delete(quickbooksOAuthStates).where(eq(quickbooksOAuthStates.id, stateRecord.id));

  const token = await postToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  }));
  const now = Date.now();
  const existing = (await db.select().from(quickbooksConnections).where(eq(quickbooksConnections.realmId, realmId)).limit(1))[0];
  const connectionValues = {
    realmId,
    companyName: existing?.companyName ?? null,
    accessTokenCiphertext: encryptQuickbooksSecret(token.access_token),
    refreshTokenCiphertext: encryptQuickbooksSecret(token.refresh_token),
    tokenExpiresAt: new Date(now + token.expires_in * 1000),
    refreshTokenExpiresAt: token.x_refresh_token_expires_in ? new Date(now + token.x_refresh_token_expires_in * 1000) : null,
    isActive: true,
    lastSyncStatus: "never" as const,
    lastSyncError: null,
  };
  await db.insert(quickbooksConnections).values(connectionValues).onDuplicateKeyUpdate({ set: connectionValues });
  const connection = (await db.select().from(quickbooksConnections).where(eq(quickbooksConnections.realmId, realmId)).limit(1))[0];
  if (!connection) throw new Error("QuickBooks connection could not be saved");
  const companyName = await fetchCompanyName(connection);
  if (companyName) await db.update(quickbooksConnections).set({ companyName }).where(eq(quickbooksConnections.id, connection.id));
  const taskUid = await ensureDailyQuickbooksSync(connection.id, connection.scheduleTaskUid);
  return { companyName, taskUid };
}

async function markSyncFailure(connection: QuickbooksConnection, runId: number, message: string) {
  const db = await getDb();
  if (!db) return;
  const safeMessage = message.slice(0, 1_000);
  await db.update(quickbooksConnections).set({ lastSyncStatus: "failed", lastSyncError: safeMessage }).where(eq(quickbooksConnections.id, connection.id));
  await db.update(quickbooksSyncRuns).set({ status: "failed", errorSummary: safeMessage, completedAt: new Date() }).where(eq(quickbooksSyncRuns.id, runId));
}

export async function syncQuickbooksConnection(connection: QuickbooksConnection, trigger: "manual" | "daily") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const insert = await db.insert(quickbooksSyncRuns).values({ connectionId: connection.id, trigger, status: "running" });
  const runId = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
  await db.update(quickbooksConnections).set({ lastSyncStatus: "running", lastSyncError: null }).where(eq(quickbooksConnections.id, connection.id));

  try {
    const since = initialOrOverlapDate(connection.lastSyncAt);
    const entityNames = ["Purchase", "Bill", "Check", "Deposit", "Transfer"];
    const batches = await Promise.all(entityNames.map(async entity => ({ entity, items: await queryEntity(connection, entity, since) })));
    const normalized = batches.flatMap(({ entity, items }) => items.map(item => normalizeQuickbooksEntity(entity, item)).filter(Boolean) as QuickbooksNormalizedTransaction[]);

    for (const item of normalized) {
      await db.insert(quickbooksTransactions).values({ connectionId: connection.id, ...item }).onDuplicateKeyUpdate({
        set: {
          transactionDate: item.transactionDate,
          direction: item.direction,
          amountCents: item.amountCents,
          currency: item.currency,
          categoryName: item.categoryName,
          accountName: item.accountName,
          payeeName: item.payeeName,
          description: item.description,
          sourceUpdatedAt: item.sourceUpdatedAt,
          updatedAt: new Date(),
        },
      });
    }

    const completedAt = new Date();
    await db.update(quickbooksConnections).set({
      lastSyncAt: completedAt,
      lastSyncStatus: "succeeded",
      lastSyncError: null,
    }).where(eq(quickbooksConnections.id, connection.id));
    await db.update(quickbooksSyncRuns).set({
      status: "succeeded",
      importedCount: normalized.length,
      completedAt,
    }).where(eq(quickbooksSyncRuns.id, runId));
    return { importedCount: normalized.length, since, completedAt };
  } catch (error) {
    await markSyncFailure(connection, runId, error instanceof Error ? error.message : "QuickBooks sync failed");
    throw error;
  }
}

export async function syncActiveQuickbooksConnection(trigger: "manual" | "daily") {
  const connection = await latestConnection();
  if (!connection) throw new Error("QuickBooks Online is not connected yet");
  return syncQuickbooksConnection(connection, trigger);
}

/**
 * Revokes Intuit access before deactivating the local connection. Imported APY
 * records remain for the owner’s operational history, but no future import can run.
 */
export async function disconnectActiveQuickbooksConnection() {
  const connection = await latestConnection();
  if (!connection) return { disconnected: false, schedulePaused: true };

  await revokeQuickbooksRefreshToken(connection);
  let schedulePaused = true;
  if (connection.scheduleTaskUid) {
    try {
      await updateHeartbeatJob(connection.scheduleTaskUid, { enable: false }, "");
    } catch {
      schedulePaused = false;
    }
  }
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(quickbooksConnections).set({
    isActive: false,
    scheduleTaskUid: null,
    accessTokenCiphertext: encryptQuickbooksSecret("revoked"),
    refreshTokenCiphertext: encryptQuickbooksSecret("revoked"),
    updatedAt: new Date(),
  }).where(eq(quickbooksConnections.id, connection.id));
  return { disconnected: true, schedulePaused };
}

export async function syncQuickbooksConnectionForSchedule(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const connection = (await db.select().from(quickbooksConnections)
    .where(and(eq(quickbooksConnections.scheduleTaskUid, taskUid), eq(quickbooksConnections.isActive, true))).limit(1))[0];
  if (!connection) return { skipped: "orphan" as const };
  return syncQuickbooksConnection(connection, "daily");
}

export async function getQuickbooksOverview() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const connection = await latestConnection();
  if (!connection) return { connection: null, summary: null, byCategory: [], byMonth: [], recentTransactions: [], aiExport: null };
  const transactions = await db.select().from(quickbooksTransactions)
    .where(eq(quickbooksTransactions.connectionId, connection.id))
    .orderBy(desc(quickbooksTransactions.transactionDate)).limit(2_500);
  const expenseCents = transactions.filter(t => t.direction === "expense").reduce((sum, t) => sum + t.amountCents, 0);
  const incomeCents = transactions.filter(t => t.direction === "income").reduce((sum, t) => sum + t.amountCents, 0);
  const transfersCents = transactions.filter(t => t.direction === "transfer").reduce((sum, t) => sum + t.amountCents, 0);
  const categoryMap = new Map<string, number>();
  const monthMap = new Map<string, { expenseCents: number; incomeCents: number }>();
  for (const transaction of transactions) {
    const month = transaction.transactionDate.slice(0, 7);
    const monthValue = monthMap.get(month) ?? { expenseCents: 0, incomeCents: 0 };
    if (transaction.direction === "expense") {
      categoryMap.set(transaction.categoryName ?? "Uncategorized", (categoryMap.get(transaction.categoryName ?? "Uncategorized") ?? 0) + transaction.amountCents);
      monthValue.expenseCents += transaction.amountCents;
    }
    if (transaction.direction === "income") monthValue.incomeCents += transaction.amountCents;
    monthMap.set(month, monthValue);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([name, expenseCents]) => ({ name, expenseCents })).sort((a, b) => b.expenseCents - a.expenseCents).slice(0, 12);
  const byMonth = Array.from(monthMap.entries()).map(([month, values]) => ({ month, ...values })).sort((a, b) => a.month.localeCompare(b.month));
  const aiExport = {
    asOf: connection.lastSyncAt?.toISOString() ?? null,
    currency: "CAD",
    importedTransactionCount: transactions.length,
    expenseCents,
    incomeCents,
    netCashMovementCents: incomeCents - expenseCents,
    topExpenseCategories: byCategory,
    monthlyCashMovement: byMonth,
    notes: "Read-only QuickBooks Online import. Transfers are excluded from net cash movement. Figures are management analysis and do not replace bookkeeping, reconciliation, or tax advice.",
  };
  return {
    connection: {
      companyName: connection.companyName,
      connected: connection.isActive,
      lastSyncAt: connection.lastSyncAt,
      lastSyncStatus: connection.lastSyncStatus,
      lastSyncError: connection.lastSyncError,
      dailyRefreshEnabled: Boolean(connection.scheduleTaskUid),
    },
    summary: { expenseCents, incomeCents, transfersCents, netCashMovementCents: incomeCents - expenseCents, transactionCount: transactions.length },
    byCategory,
    byMonth,
    recentTransactions: transactions.slice(0, 100),
    aiExport,
  };
}

export async function buildQuickbooksAnalysisContext() {
  const overview = await getQuickbooksOverview();
  if (!overview.aiExport || !overview.summary) throw new Error("Sync QuickBooks data before requesting an analysis");
  return overview.aiExport;
}
