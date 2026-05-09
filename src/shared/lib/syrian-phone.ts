// Syrian phone helpers — strictly Syria (+963)
// Mobile format: 9 digits after leading 0 (e.g. 0933123456) or +963 9XXXXXXXX

export const SY_DIAL_CODE = "+963";
export const SY_PHONE_PLACEHOLDER = "مثال: 0933123456";

/** Accepts: 09XXXXXXXX (10 digits) OR +9639XXXXXXXX OR 9639XXXXXXXX */
export function isValidSyrianPhone(input: string): boolean {
  if (!input) return false;
  const v = input.replace(/[\s-]/g, "");
  return /^(?:\+?963|0)9\d{8}$/.test(v);
}

/** Normalize to local format starting with 0 (e.g. 0933123456). */
export function normalizeSyrianLocal(input: string): string {
  const v = (input || "").replace(/[\s-]/g, "");
  if (/^\+?963\d+$/.test(v)) return "0" + v.replace(/^\+?963/, "");
  return v;
}

/** Normalize to international (no +): 9639XXXXXXXX — for wa.me links. */
export function toIntlSyrian(input: string): string {
  const local = normalizeSyrianLocal(input);
  if (/^09\d{8}$/.test(local)) return "963" + local.slice(1);
  const v = (input || "").replace(/[\s\-+]/g, "");
  return v;
}

/** Restrict typing to digits and a single optional leading + (max 13 chars). */
export function sanitizeSyrianInput(raw: string): string {
  let v = raw.replace(/[^\d+]/g, "");
  // only one leading +
  v = v.replace(/\++/g, "+");
  if (v.indexOf("+") > 0) v = v.replace(/\+/g, "");
  // length cap: +963XXXXXXXXX = 13, 09XXXXXXXX = 10
  if (v.startsWith("+")) v = v.slice(0, 13);
  else v = v.slice(0, 10);
  return v;
}

export const SY_PHONE_ERROR =
  "رقم سوري غير صحيح. مثال: 0933123456 أو +963933123456";
