// Strong Sila Code generator (mirrors public.generate_sila_code in Postgres).
// Format:  SL-XXXXXXXX-C
//   8 random chars from 31-char alphabet (no 0/1/I/L/O — visually unambiguous)
//   1 checksum char  = sum(indices) mod 31, mapped back to alphabet
// Search space: 31^8 ≈ 8.5e11 → effectively no collisions.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars
const SILA_REGEX = /^SL-[A-Z2-9]{8}-[A-Z2-9]$/;

const checksum = (body: string): string => {
  let sum = 0;
  for (const ch of body) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return "";
    sum += idx;
  }
  return ALPHABET[sum % 31];
};

export const generateSilaCode = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[bytes[i] % 31];
  }
  return `SL-${body}-${checksum(body)}`;
};

export const normalizeSilaCode = (input: string): string =>
  (input || "").toUpperCase().replace(/\s+/g, "");

export const validateSilaCode = (input: string): boolean => {
  const v = normalizeSilaCode(input);
  if (!SILA_REGEX.test(v)) return false;
  return checksum(v.slice(3, 11)) === v.slice(12, 13);
};
