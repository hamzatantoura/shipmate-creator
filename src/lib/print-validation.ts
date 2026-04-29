/**
 * Pre-print validation. Mirrors the server-side trigger
 * `validate_order_print_readiness` so the UI can fail fast with a clear
 * Arabic message before hitting the database.
 */

export interface PrintValidatableOrder {
  status: string;
  phone_number: string | null;
  district_id: string | null;
  receiver_name?: string | null;
}

/** Returns digits-only local Syrian phone (10 digits) or null if not normalizable. */
export function normalizeSyrianLocalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("00963")) p = "0" + p.slice(5);
  else if (p.startsWith("963") && p.length >= 12) p = "0" + p.slice(3);
  return p.length === 10 ? p : null;
}

export interface PrintValidationResult {
  ok: boolean;
  /** Localized Arabic error suitable for a toast. */
  error?: string;
}

const PRINTABLE_STATUSES = new Set(["new", "processing"]);

export function validateOrderForPrinting(o: PrintValidatableOrder): PrintValidationResult {
  if (o.status === "draft") {
    return { ok: false, error: "لا يمكن طباعة بوليصة لطلب في وضع المسودة — يرجى تأكيد الطلب أولاً" };
  }
  if (!PRINTABLE_STATUSES.has(o.status)) {
    return { ok: false, error: "يمكن طباعة البوليصة فقط للطلبات الجديدة أو قيد المعالجة" };
  }
  if (!o.district_id) {
    return { ok: false, error: "يجب تحديد المنطقة قبل طباعة البوليصة" };
  }
  if (!normalizeSyrianLocalPhone(o.phone_number)) {
    return { ok: false, error: "رقم هاتف المستلم يجب أن يكون 10 أرقام محلية صحيحة" };
  }
  if (!o.receiver_name || !o.receiver_name.trim()) {
    return { ok: false, error: "اسم المستلم مطلوب قبل الطباعة" };
  }
  return { ok: true };
}

export interface BulkPrintValidationResult {
  printable: PrintValidatableOrder[];
  blocked: Array<{ order: PrintValidatableOrder; error: string }>;
}

export function partitionOrdersForPrinting<T extends PrintValidatableOrder>(
  orders: T[],
): { printable: T[]; blocked: Array<{ order: T; error: string }> } {
  const printable: T[] = [];
  const blocked: Array<{ order: T; error: string }> = [];
  for (const o of orders) {
    const res = validateOrderForPrinting(o);
    if (res.ok) printable.push(o);
    else blocked.push({ order: o, error: res.error || "غير صالح للطباعة" });
  }
  return { printable, blocked };
}