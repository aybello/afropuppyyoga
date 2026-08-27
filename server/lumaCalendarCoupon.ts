const LUMA_BASE = "https://public-api.luma.com/v1";
const UNLIMITED_REBOOKING_USES = 1_000_000;
const MAX_COUPON_PAGES = 50;

export type LumaCalendarCoupon = {
  id: string;
  code: string;
  remaining_count: number;
  percent_off: number | null;
  cents_off: number | null;
};

type CouponListResponse = {
  entries?: LumaCalendarCoupon[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export function rebookingCodeForClassDate(startAt: string | Date): string {
  const date = startAt instanceof Date ? startAt : new Date(startAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error("The cancelled class has an invalid start time");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  }).formatToParts(date);
  const month = parts.find(part => part.type === "month")?.value?.toUpperCase();
  const day = parts.find(part => part.type === "day")?.value;
  if (!month || !day) throw new Error("Could not create the rebooking code");
  return `${month}${day}`;
}

async function listCalendarCoupons(apiKey: string, fetchImpl: typeof fetch): Promise<LumaCalendarCoupon[]> {
  const coupons: LumaCalendarCoupon[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_COUPON_PAGES; page += 1) {
    const url = new URL(`${LUMA_BASE}/calendars/coupons/list`);
    url.searchParams.set("pagination_limit", "100");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const response = await fetchImpl(url, {
      headers: { "x-luma-api-key": apiKey, accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Luma could not list calendar coupons (${response.status})`);
    }

    const body = (await response.json()) as CouponListResponse;
    coupons.push(...(body.entries ?? []));
    cursor = body.has_more ? body.next_cursor ?? null : null;
    if (!cursor) return coupons;
  }

  throw new Error("Luma calendar coupon list exceeded the safety page limit");
}

/**
 * Ensures the daily rebooking code is a free, unrestricted coupon on the
 * APY calendar. Calendar coupons apply to all events managed by the calendar.
 */
export async function ensureFreeCalendarRebookingCoupon(
  code: string,
  options: { apiKey: string; fetchImpl?: typeof fetch } = { apiKey: "" },
): Promise<{ code: string; couponId: string; state: "created" | "reused" }> {
  const apiKey = options.apiKey || process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(normalizedCode)) {
    throw new Error("The rebooking code must be 1–20 letters or numbers");
  }

  const existing = (await listCalendarCoupons(apiKey, fetchImpl)).find(
    coupon => coupon.code.toUpperCase() === normalizedCode,
  );
  if (existing) {
    if (existing.percent_off !== 100 || existing.cents_off !== null || existing.remaining_count <= 0) {
      throw new Error(`The existing calendar code ${normalizedCode} is not an active 100% free rebooking code`);
    }
    return { code: normalizedCode, couponId: existing.id, state: "reused" };
  }

  const response = await fetchImpl(`${LUMA_BASE}/calendars/coupons/create`, {
    method: "POST",
    headers: {
      "x-luma-api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      code: normalizedCode,
      remaining_count: UNLIMITED_REBOOKING_USES,
      discount: { discount_type: "percent", percent_off: 100 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Luma could not create the free calendar rebooking code (${response.status})`);
  }

  const coupon = (await response.json()) as LumaCalendarCoupon;
  if (coupon.percent_off !== 100 || coupon.cents_off !== null) {
    throw new Error("Luma created a coupon that is not 100% free");
  }
  return { code: normalizedCode, couponId: coupon.id, state: "created" };
}
