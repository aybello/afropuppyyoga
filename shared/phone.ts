/**
 * Normalizes a Canadian/NANP phone number to +1XXXXXXXXXX.
 * Accepts common formats such as 2897881885, (289) 788-1885, and +1 289-788-1885.
 */
export function normalizeCanadianPhoneNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  // NANP area codes and exchange codes cannot begin with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nationalNumber)) return null;
  return `+1${nationalNumber}`;
}

export function formatCanadianPhoneNumber(value: string): string {
  const normalized = normalizeCanadianPhoneNumber(value);
  if (!normalized) return value;
  const digits = normalized.slice(2);
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
