import { createHash } from "node:crypto";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobApplications, signingTokens, staffingMutationLocks, type SigningToken } from "../drizzle/schema";
import { recordCurrentOfferSignature } from "./hiringOfferLifecycle";
import { createOfferDocumentSnapshot, readOfferDocumentSnapshot, type OfferDocumentSource } from "./offerDocumentSnapshot";
import type { OfferLetterType } from "./signingPolicy";

const external = vi.hoisted(() => ({
  db: {
    getDb: vi.fn(), createSigningToken: vi.fn(), getSigningTokenByToken: vi.fn(),
    updateSigningToken: vi.fn(), getSigningTokenByApplicationId: vi.fn(),
    getJobApplicationById: vi.fn(), updateJobApplication: vi.fn(),
    updateJobApplicationStatusIfUnclaimed: vi.fn(),
  },
  notifyOwner: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("./db", () => external.db);
vi.mock("./_core/notification", () => ({ notifyOwner: external.notifyOwner }));
vi.mock("./email", () => ({ sendEmail: external.sendEmail }));
import { signingRouter } from "./routers/signing";

const CREATED_AT = new Date("2026-02-18T03:04:05.000Z");
const NOW = new Date("2026-03-10T15:00:00.000Z");
const source: OfferDocumentSource = {
  applicantName: "Fictional Applicant",
  role: "Puppy Monitor",
  location: "Kitchener",
  offerLetterType: "puppy_monitor_kw",
  puppyMonitorShiftPayCad: null,
  movementInstructorHourlyPayCad: null,
  socialMediaHourlyPayCad: null,
  createdAt: CREATED_AT,
};

const roles: Array<{ type: OfferLetterType; role: string; location: string; compensation: string }> = [
  { type: "puppy_monitor_kw", role: "Puppy Monitor", location: "Kitchener", compensation: "$50.00 per shift" },
  { type: "puppy_monitor_hamilton", role: "Puppy Monitor", location: "Hamilton", compensation: "$50.00 per shift" },
  { type: "yoga_instructor", role: "Yoga Instructor", location: "Kitchener", compensation: "$22.00 per hour for teaching yoga classes" },
  { type: "movement_instructor", role: "Movement Instructor", location: "Kitchener", compensation: "CA$20.00 per hour for guided movement sessions" },
  { type: "puppy_specialist", role: "Puppy Specialist", location: "Kitchener", compensation: "$18.00 per hour" },
  { type: "operations_specialist", role: "Operations Specialist", location: "Kitchener", compensation: "$20.00 per hour" },
  { type: "operations_manager", role: "Operations Manager", location: "Kitchener", compensation: "Compensation and approved hours will follow the terms confirmed in writing by APY." },
  { type: "bdr", role: "BDR", location: "REMOTE", compensation: "7% commission on inbound business and 10% commission on outbound business, calculated on Eligible Collected Revenue." },
  { type: "social_media_intern", role: "Social Media Intern", location: "REMOTE", compensation: "Paid part-time role. Compensation and approved hours will follow the terms confirmed in writing by APY." },
  { type: "social_media_specialist", role: "Social Media Specialist", location: "REMOTE", compensation: "Paid part-time role. Compensation and approved hours will follow the terms confirmed in writing by APY." },
];

function roleSource(role: typeof roles[number]): OfferDocumentSource {
  return { ...source, role: role.role, location: role.location, offerLetterType: role.type };
}

function offerRecord(overrides: Partial<SigningToken> = {}): SigningToken {
  return {
    id: 2, applicationId: 42, applicantName: source.applicantName,
    applicantEmail: "applicant@example.com", role: source.role, location: source.location,
    offerLetterType: "puppy_monitor_kw", puppyMonitorShiftPayCad: null,
    movementInstructorHourlyPayCad: null, socialMediaHourlyPayCad: null,
    signedDocumentSnapshot: null, token: "fictional-snapshot-token", signed: 0,
    signedName: null, signedIp: null, signedAt: null,
    expiresAt: new Date("2026-04-01T00:00:00.000Z"), createdAt: CREATED_AT,
    ...overrides,
  };
}

/** A staged in-memory transaction double, not a database integration test.
 * Unlike the existing callback-only harness, rejected callbacks discard all writes.
 * Only the production staffing lock's upsert/read are exempt from domain-write assertions.
 */
function transactionalHarness(record = offerRecord(), signatureAffectedRows = 1) {
  const applicant = {
    id: record.applicationId, name: record.applicantName, email: record.applicantEmail,
    role: record.role, location: record.location, status: "new", isTeamMember: false,
    deletedAt: null, onboardingDeliveryToken: null,
  };
  let committed = structuredClone({ applicant, offer: record });
  const writes: Array<{ table: unknown; values: Record<string, unknown>; predicate: SQL; affectedRows: number }> = [];
  const lockReads: unknown[] = [];
  const lockSeeds: unknown[] = [];
  const commits: typeof committed[] = [];
  const rollbacks: typeof committed[] = [];
  const dialect = new MySqlDialect();
  const db = {
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const pending = structuredClone(committed);
      const tx = {
        select: vi.fn(() => {
          let rows: unknown[] = [];
          const chain = {
            from(table: unknown) {
              if (table === staffingMutationLocks) {
                lockReads.push(table);
                rows = [{ lockName: "apy_staffing_mutation_v1" }];
              } else if (table === signingTokens) rows = [structuredClone(pending.offer)];
              else if (table === jobApplications) rows = [structuredClone(pending.applicant)];
              else throw new Error("Unexpected table read in snapshot lifecycle test");
              return chain;
            },
            where: (_predicate: SQL) => chain,
            orderBy: (..._columns: unknown[]) => chain,
            limit: async (_limit: number) => rows,
            for: async (mode: string) => {
              expect(mode).toBe("update");
              return rows;
            },
          };
          return chain;
        }),
        insert: (table: unknown) => ({ values: (values: unknown) => ({
          onDuplicateKeyUpdate: async () => {
            if (table !== staffingMutationLocks) throw new Error("Unexpected domain insert");
            lockSeeds.push(values);
            return [{ affectedRows: 1 }];
          },
        }) }),
        update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({
          where: async (predicate: SQL) => {
            const affectedRows = table === signingTokens ? signatureAffectedRows : 1;
            writes.push({ table, values, predicate, affectedRows });
            if (affectedRows === 1) {
              if (table === jobApplications) Object.assign(pending.applicant, values);
              else if (table === signingTokens) Object.assign(pending.offer, values);
              else throw new Error("Unexpected table update in snapshot lifecycle test");
            }
            return [{ affectedRows }];
          },
        }) }),
      };
      try {
        const result = await callback(tx);
        committed = structuredClone(pending);
        commits.push(structuredClone(pending));
        return result;
      } catch (error) {
        rollbacks.push(structuredClone(pending));
        throw error;
      }
    }),
  };
  return {
    db, writes, commits, rollbacks, lockReads, lockSeeds,
    get state() { return structuredClone(committed); },
    query: (predicate: SQL) => dialect.sqlToQuery(predicate),
  };
}

function sign(h: ReturnType<typeof transactionalHarness>, record: SigningToken, digest: string) {
  return recordCurrentOfferSignature(h.db, record.token, record.applicantName, "192.0.2.7",
    record.offerLetterType, record.puppyMonitorShiftPayCad ?? undefined,
    record.movementInstructorHourlyPayCad ?? undefined, record.socialMediaHourlyPayCad ?? undefined, digest);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // Any unexpected route DB access fails closed; there is never a live DB/mail call.
  external.db.getDb.mockRejectedValue(new Error("Unexpected database access in isolated test"));
  external.sendEmail.mockResolvedValue(undefined);
  external.notifyOwner.mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); });

describe("version 1 offer document snapshots", () => {
  it("locks the actual offer/NDA HTML, Toronto document date, version and SHA to a fixed createdAt", () => {
    const snapshot = createOfferDocumentSnapshot(source);
    expect(snapshot).toMatchInlineSnapshot(`
      {
        "documentDate": "2026-02-18T03:04:05.000Z",
        "ndaHtml": "<div class="space-y-4 text-sm text-[#1A0A12] leading-relaxed"><p class="text-center font-bold text-base text-[#8B2252]">NON-DISCLOSURE AGREEMENT</p><p class="text-xs text-[#C4A0B0] text-center">February 17, 2026</p><p>This Non-Disclosure Agreement (&quot;Agreement&quot;) is entered into between <strong>AfroPuppyYoga</strong> (&quot;Company&quot;) and <strong>Fictional Applicant</strong> (&quot;Recipient&quot;) in connection with the Recipient&#x27;s role as <strong>Puppy Monitor</strong>.</p><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">1. Confidential Information</p><p>&quot;Confidential Information&quot; means any non-public information disclosed by the Company to the Recipient, including but not limited to: business operations, class formats, pricing, client lists, marketing strategies, supplier relationships, financial information, and any other proprietary information relating to AfroPuppyYoga&#x27;s business.</p></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">2. Obligations</p><p>The Recipient agrees to:</p><ul class="list-disc pl-5 space-y-1 mt-2"><li>Keep all Confidential Information strictly confidential</li><li>Not disclose Confidential Information to any third party without prior written consent from the Company</li><li>Use Confidential Information solely for the purpose of fulfilling their role at AfroPuppyYoga</li><li>Not copy, reproduce, or distribute any Confidential Information without authorization</li></ul></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">3. Social Media and Brand Representation</p><p>The Recipient agrees not to post, share, or publish any content related to AfroPuppyYoga&#x27;s operations, internal processes, client information, or proprietary materials on social media or any public platform without prior written approval from the Company.</p></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">4. Duration</p><p>This Agreement shall remain in effect during the Recipient&#x27;s engagement with AfroPuppyYoga and for a period of <strong>2 years</strong> following the termination of such engagement.</p></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">5. Remedies</p><p>The Recipient acknowledges that any breach of this Agreement may cause irreparable harm to AfroPuppyYoga and that the Company shall be entitled to seek equitable relief, including injunctive relief, in addition to all other remedies available at law.</p></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">6. Governing Law</p><p>This Agreement shall be governed by the laws of the Province of Ontario, Canada.</p></div><div class="border-t border-[#F0D0DC] pt-4"><p>By signing below, the Recipient acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.</p></div></div>",
        "offerHtml": "<div class="space-y-4 text-sm text-[#1A0A12] leading-relaxed"><p class="text-xs text-[#C4A0B0]">February 17, 2026</p><p>Dear <strong>Fictional Applicant</strong>,</p><p>On behalf of the entire AfroPuppyYoga team, we are thrilled to offer you the volunteer position of <strong>Puppy Monitor</strong> at our <strong>Kitchener</strong> location!</p><p>You stood out to us with your energy, passion, and alignment with our mission — blending wellness, culture, and puppy love in a way that&#x27;s truly one of a kind. We can&#x27;t wait to have you on the team.</p><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p><p><strong>Position:</strong> Puppy Monitor</p><p><strong>Location:</strong> Kitchener</p><p><strong>Compensation:</strong> $50.00 per shift</p></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p><ul class="list-disc pl-5 space-y-1"><li>Assist with class setup and breakdown before and after each session</li><li>Monitor puppy welfare and safety throughout the class</li><li>Support participant check-in and ensure a welcoming environment</li><li>Handle puppies with care and follow APY&#x27;s puppy safety guidelines at all times</li><li>Represent the AfroPuppyYoga brand with professionalism and warmth</li></ul></div><div class="border-t border-[#F0D0DC] pt-4"><p class="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p><p><strong>Probation Period:</strong> A probationary period of 4 months will apply.</p><p class="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga&#x27;s proprietary information.</p><p class="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks&#x27; written notice whenever reasonably possible. This helps APY arrange class coverage and maintain a consistent guest experience.</p><p class="mt-2"><strong>Dress Code:</strong> Black yoga attire and grippy socks are required for all sessions.</p></div><div class="border-t border-[#F0D0DC] pt-4"><p>We are so excited to welcome you into the AfroPuppyYoga family. The puppies are already excited to meet you! 🐶💕</p><p class="mt-3">Warmly,</p><p class="font-bold">Ay &amp; The AfroPuppyYoga Team</p><p class="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p></div></div>",
        "sha256": "5dafcb034c9de37d3b21d975a9ea6c887e74d235e223d1799b45501a3e623ca5",
        "version": 1,
      }
    `);
    expect(snapshot.documentDate).toBe("2026-02-18T03:04:05.000Z");
    expect(snapshot.offerHtml).toContain("February 17, 2026");
    expect(snapshot.ndaHtml).toContain("February 17, 2026");
    const { sha256, ...content } = snapshot;
    expect(sha256).toBe(createHash("sha256").update(JSON.stringify(content)).digest("hex"));
    expect(readOfferDocumentSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("renders byte-identical documents and SHA across clock-day and DST changes", () => {
    const before = createOfferDocumentSnapshot(source);
    for (const clock of ["2026-03-11T15:00:00Z", "2026-11-02T06:00:00Z", "2030-01-01T01:00:00Z"]) {
      vi.setSystemTime(new Date(clock));
      expect(createOfferDocumentSnapshot(source)).toEqual(before);
    }
  });

  it.each([
    ["role text", { role: "Puppy Monitor (weekend assignment)" }],
    ["role template", { role: "Operations Specialist", offerLetterType: "operations_specialist" }],
    ["saved pay", { puppyMonitorShiftPayCad: 60 }],
    ["applicant text", { applicantName: "Another Applicant" }],
    ["location text", { location: "Hamilton" }],
  ] satisfies Array<[string, Partial<OfferDocumentSource>]>) (
    "changes the digest when %s changes", (_label, change) => {
      const original = createOfferDocumentSnapshot(source);
      const changed = createOfferDocumentSnapshot({ ...source, ...change });
      expect(changed.sha256).not.toBe(original.sha256);
      expect([changed.offerHtml, changed.ndaHtml]).not.toEqual([original.offerHtml, original.ndaHtml]);
    },
  );

  it("escapes malicious applicant, role and location HTML instead of creating executable markup", () => {
    const snapshot = createOfferDocumentSnapshot({
      ...source,
      applicantName: '<script>alert("name")</script> & O\'Neil',
      role: '<svg onload="alert(1)">Role</svg>',
      location: '<img src=x onerror="alert(2)"> & Studio',
    });
    for (const html of [snapshot.offerHtml, snapshot.ndaHtml]) {
      expect(html).toContain("&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt; &amp; O&#x27;Neil");
      expect(html).not.toMatch(/<(script|svg|img)\b/i);
    }
    expect(snapshot.offerHtml).toContain("&lt;img src=x onerror=&quot;alert(2)&quot;&gt; &amp; Studio");
    expect(snapshot.ndaHtml).toContain("&lt;svg onload=&quot;alert(1)&quot;&gt;Role&lt;/svg&gt;");
    expect(readOfferDocumentSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it.each(["offerHtml", "ndaHtml", "documentDate", "sha256"] as const)("rejects tampering with %s", (field) => {
    const snapshot = createOfferDocumentSnapshot(source);
    const changed = { ...snapshot, [field]: field === "documentDate" ? "2026-02-19T03:04:05.000Z"
      : field === "sha256" ? "0".repeat(64) : `${snapshot[field]}<p>Altered terms</p>` };
    expect(() => readOfferDocumentSnapshot(JSON.stringify(changed))).toThrow(/could not be verified/);
  });

  it("rejects an unsupported version even if its SHA matches its content", () => {
    const { sha256: _sha, ...original } = createOfferDocumentSnapshot(source);
    const content = { ...original, version: 2 };
    const sha256 = createHash("sha256").update(JSON.stringify(content)).digest("hex");
    expect(() => readOfferDocumentSnapshot(JSON.stringify({ ...content, sha256 }))).toThrow();
  });

  it.each(["not json", "null", "{}"])("rejects malformed saved snapshots: %s", (value) => {
    expect(() => readOfferDocumentSnapshot(value)).toThrow();
  });

  it("rejects an unknown template type instead of silently rendering a Puppy Monitor letter", () => {
    expect(() => createOfferDocumentSnapshot({ ...source, offerLetterType: "unapproved_template" })).toThrow();
  });

  it.each(roles)("preserves nullable legacy compensation for $type", (role) => {
    const legacy = Object.freeze(roleSource(role));
    const snapshot = createOfferDocumentSnapshot(legacy);
    expect(snapshot.offerHtml).toContain(`<strong>Compensation:</strong> ${role.compensation}`);
    expect(snapshot.ndaHtml).toContain(`<strong>${role.role}</strong>`);
    expect(legacy.puppyMonitorShiftPayCad).toBeNull();
    expect(legacy.movementInstructorHourlyPayCad).toBeNull();
    expect(legacy.socialMediaHourlyPayCad).toBeNull();
    const { puppyMonitorShiftPayCad: _puppy, movementInstructorHourlyPayCad: _movement,
      socialMediaHourlyPayCad: _social, ...omittedPay } = legacy;
    expect(createOfferDocumentSnapshot(omittedPay)).toEqual(snapshot);
    expect(readOfferDocumentSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("pins the legacy text of every supported template with independent golden SHA values", () => {
    expect(roles.map((role) => ({ type: role.type, sha256: createOfferDocumentSnapshot(roleSource(role)).sha256 })))
      .toMatchInlineSnapshot(`
        [
          {
            "sha256": "5dafcb034c9de37d3b21d975a9ea6c887e74d235e223d1799b45501a3e623ca5",
            "type": "puppy_monitor_kw",
          },
          {
            "sha256": "02b4f04d80ab60366899f38945aac389acdda207c8ec6ded8e68c172e26b65d2",
            "type": "puppy_monitor_hamilton",
          },
          {
            "sha256": "8969c71c2af360dcfc6b85d3419057c5688a0948b3ef6900c27f5c99678fa275",
            "type": "yoga_instructor",
          },
          {
            "sha256": "29daa61d7315f61c0eabd37d41d81685b28d51300448839ba0b9d88d5b5ae78d",
            "type": "movement_instructor",
          },
          {
            "sha256": "227000587100321d4ff55a9a224dd5e0e437f5538710d4c5cdf84a1bb46a2862",
            "type": "puppy_specialist",
          },
          {
            "sha256": "2a923e04bc48a27c6dfe40d592c699e117c2b696c7d094aa203addc99871ac66",
            "type": "operations_specialist",
          },
          {
            "sha256": "b504d5958070de5ce433c81cb13e83e0772681beaa7c46006b0f0321885049ec",
            "type": "operations_manager",
          },
          {
            "sha256": "dd1ce7a0c35e56ace98885f6684f1d112377ef844f9afd64fe7a19ed45bbe736",
            "type": "bdr",
          },
          {
            "sha256": "3c2d5d6c6d9819d9cf4fdf5a86aadeb0a57de3a89ef64a632053c81bfaf7294a",
            "type": "social_media_intern",
          },
          {
            "sha256": "f366a5aa9cb728faaeb40cf76dd6a16180d89b969612d07312f620c0397362a0",
            "type": "social_media_specialist",
          },
        ]
      `);
  });
});

describe("signature and snapshot atomicity (staged transaction double)", () => {
  it("never rewrites a previously signed offer or application", async () => {
    const saved = JSON.stringify(createOfferDocumentSnapshot(source));
    const record = offerRecord({ signed: 1, signedDocumentSnapshot: saved, signedName: "Original Signer",
      signedAt: new Date("2026-02-20T12:00:00Z"), signedIp: "192.0.2.1" });
    const h = transactionalHarness(record);
    const original = h.state;
    await expect(sign(h, record, "0".repeat(64))).rejects.toThrow("already been signed");
    expect(h.writes).toEqual([]);
    expect(h.state).toEqual(original);
    expect(h.commits).toHaveLength(0);
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.lockReads).toEqual([staffingMutationLocks]);
  });

  it("rejects a mismatching digest before any status or signature update", async () => {
    const record = offerRecord();
    const h = transactionalHarness(record);
    const original = h.state;
    await expect(sign(h, record, "0".repeat(64))).rejects.toThrow("review the current documents");
    expect(h.writes).toEqual([]);
    expect(h.state).toEqual(original);
    expect(h.commits).toHaveLength(0);
    expect(h.rollbacks).toHaveLength(1);
  });

  const signingCases: Array<{ label: string; record: SigningToken }> = [
    ...roles.map((role) => ({ label: `${role.type} legacy NULL`, record: offerRecord({
      role: role.role, location: role.location, offerLetterType: role.type,
    }) })),
    { label: "Puppy Monitor saved CA$50", record: offerRecord({ puppyMonitorShiftPayCad: 50 }) },
    { label: "Puppy Monitor saved CA$60", record: offerRecord({ puppyMonitorShiftPayCad: 60 }) },
    { label: "Hamilton Puppy Monitor saved CA$60", record: offerRecord({ location: "Hamilton", offerLetterType: "puppy_monitor_hamilton", puppyMonitorShiftPayCad: 60 }) },
    ...[20, 22].map((pay) => ({ label: `Movement Instructor saved CA$${pay}`, record: offerRecord({
      role: "Movement Instructor", offerLetterType: "movement_instructor", movementInstructorHourlyPayCad: pay,
    }) })),
    ...(["social_media_intern", "social_media_specialist"] as const).map((type) => ({
      label: `${type} saved CA$19`, record: offerRecord({ role: type === "social_media_intern" ? "Social Media Intern" : "Social Media Specialist",
        location: "REMOTE", offerLetterType: type, socialMediaHourlyPayCad: 19 }),
    })),
  ];
  it.each(signingCases)("commits the exact reviewed JSON with the signature without changing pay: $label", async ({ record }) => {
    const reviewed = createOfferDocumentSnapshot(record);
    const h = transactionalHarness(record);
    await expect(sign(h, record, reviewed.sha256)).resolves.toEqual(record);
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.lockSeeds).toEqual([{ lockName: "apy_staffing_mutation_v1" }]);
    expect(h.lockReads).toEqual([staffingMutationLocks]);
    expect(h.writes).toHaveLength(2);
    expect(h.writes[0]).toMatchObject({ table: jobApplications, values: { status: "accepted" } });
    expect(h.writes[1]).toMatchObject({ table: signingTokens, values: {
      signed: 1, signedName: record.applicantName, signedIp: "192.0.2.7", signedAt: NOW,
      signedDocumentSnapshot: JSON.stringify(reviewed),
    } });
    expect(h.query(h.writes[1].predicate)).toMatchObject({
      sql: "(`signingTokens`.`id` = ? and `signingTokens`.`signed` = ?)", params: [record.id, 0],
    });
    for (const { values } of h.writes) {
      expect(values).not.toHaveProperty("puppyMonitorShiftPayCad");
      expect(values).not.toHaveProperty("movementInstructorHourlyPayCad");
      expect(values).not.toHaveProperty("socialMediaHourlyPayCad");
    }
    expect(h.commits).toHaveLength(1);
    expect(h.rollbacks).toHaveLength(0);
    expect(h.state.applicant.status).toBe("accepted");
    expect(h.state.offer).toEqual({ ...record, signed: 1, signedName: record.applicantName,
      signedIp: "192.0.2.7", signedAt: NOW, signedDocumentSnapshot: JSON.stringify(reviewed) });
    expect(readOfferDocumentSnapshot(h.state.offer.signedDocumentSnapshot!)).toEqual(reviewed);
  });

  it("discards the staged accepted status when the guarded signature update affects zero rows", async () => {
    const record = offerRecord({ puppyMonitorShiftPayCad: 60 });
    const h = transactionalHarness(record, 0);
    const original = h.state;
    await expect(sign(h, record, createOfferDocumentSnapshot(record).sha256)).rejects.toThrow("This offer changed");
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.writes.map(({ table, affectedRows }) => ({ table, affectedRows }))).toEqual([
      { table: jobApplications, affectedRows: 1 }, { table: signingTokens, affectedRows: 0 },
    ]);
    // Prove a status mutation occurred in the transaction before it was discarded.
    expect(h.rollbacks).toHaveLength(1);
    expect(h.rollbacks[0].applicant.status).toBe("accepted");
    expect(h.rollbacks[0].offer.signed).toBe(0);
    expect(h.rollbacks[0].offer.signedDocumentSnapshot).toBeNull();
    expect(h.commits).toHaveLength(0);
    expect(h.state).toEqual(original);
  });
});

describe("public submitSignature document confirmation schema", () => {
  const baseInput = { token: "fictional-snapshot-token", signedName: "Fictional Applicant", confirmedOfferLetterType: "puppy_monitor_kw" };
  it.each([
    ["missing", {}], ["undefined", { confirmedDocumentSha256: undefined }],
    ["null", { confirmedDocumentSha256: null }], ["empty", { confirmedDocumentSha256: "" }],
    ["short", { confirmedDocumentSha256: "a".repeat(63) }],
    ["long", { confirmedDocumentSha256: "a".repeat(65) }],
    ["non-hex", { confirmedDocumentSha256: "g".repeat(64) }],
    ["uppercase", { confirmedDocumentSha256: "A".repeat(64) }],
  ])("rejects a %s digest before database access, writes or notifications", async (_label, invalidDigest) => {
    const caller = signingRouter.createCaller({ user: null } as never);
    const input = { ...baseInput, ...(invalidDigest as object) } as Parameters<typeof caller.submitSignature>[0];
    await expect(caller.submitSignature(input)).rejects.toMatchObject({
      code: "BAD_REQUEST", cause: { issues: expect.arrayContaining([
        expect.objectContaining({ path: ["confirmedDocumentSha256"] }),
      ]) },
    });
    for (const fn of Object.values(external.db)) expect(fn).not.toHaveBeenCalled();
    expect(external.notifyOwner).not.toHaveBeenCalled();
    expect(external.sendEmail).not.toHaveBeenCalled();
  });

  it("forwards a syntactically valid but stale digest to the real lifecycle and writes no signature", async () => {
    const h = transactionalHarness();
    external.db.getDb.mockResolvedValue(h.db);
    const caller = signingRouter.createCaller({ user: null, req: { headers: {} } } as never);
    await expect(caller.submitSignature({ ...baseInput, confirmedDocumentSha256: "0".repeat(64) }))
      .rejects.toThrow("review the current documents");
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.writes).toEqual([]);
    expect(h.commits).toHaveLength(0);
    expect(external.notifyOwner).not.toHaveBeenCalled();
    expect(external.sendEmail).not.toHaveBeenCalled();
  });
});
