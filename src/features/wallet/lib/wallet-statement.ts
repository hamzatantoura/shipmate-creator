import { supabase } from "@/integrations/supabase/client";

const TYPE_LABEL: Record<string, string> = {
  top_up: "شحن رصيد",
  topup: "شحن رصيد",
  shipping_fee: "أجور شحن",
  cod_settlement: "تحصيل قيمة طلب",
  commission: "بدل تحصيل",
  carrier_adjustment: "تسوية محاسبية",
  return_fee: "رسوم مرتجع",
  return_cost: "تكلفة مرتجع",
  payout: "سحب أرباح",
  refund: "استرداد",
};

const escapeCsv = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const triggerDownload = (csv: string, filename: string) => {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Download a wallet statement CSV for a merchant. */
export async function downloadWalletStatement(merchantId: string) {
  const { data: walletRow } = await supabase
    .from("wallets")
    .select("id, balance")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (!walletRow?.id) throw new Error("لا توجد محفظة لهذا الحساب");

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount, description, reference_id, created_at")
    .eq("wallet_id", walletRow.id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = data || [];
  let running = 0;
  const lines: string[] = [];
  lines.push(
    [
      "رقم الحركة",
      "التاريخ",
      "النوع",
      "الوصف",
      "المرجع",
      "وارد (ل.س)",
      "صادر (ل.س)",
      "الرصيد بعد الحركة (ل.س)",
    ]
      .map(escapeCsv)
      .join(","),
  );
  for (const r of rows as any[]) {
    const amt = Number(r.amount);
    running += amt;
    lines.push(
      [
        r.id,
        new Date(r.created_at).toLocaleString("ar-SY"),
        TYPE_LABEL[r.type] || r.type,
        r.description || "",
        r.reference_id ? "SL-" + String(r.reference_id).slice(0, 6).toUpperCase() : "",
        amt > 0 ? amt : "",
        amt < 0 ? Math.abs(amt) : "",
        Math.round(running),
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(lines.join("\r\n"), `wallet-statement-${stamp}.csv`);
  return rows.length;
}

/** Download an "invoice" / receipt CSV for a single payout request. */
export async function downloadPayoutInvoice(payoutId: string) {
  const { data, error } = await supabase
    .from("payout_requests")
    .select("id, amount, method, account_details, status, admin_note, created_at, updated_at, merchant_id")
    .eq("id", payoutId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("طلب التسوية غير موجود");

  const lines: string[] = [];
  lines.push("كشف طلب تسوية مالية — منصة صِلة");
  lines.push("");
  lines.push(["رقم الطلب", data.id].map(escapeCsv).join(","));
  lines.push(["تاريخ الطلب", new Date(data.created_at).toLocaleString("ar-SY")].map(escapeCsv).join(","));
  lines.push(["آخر تحديث", new Date(data.updated_at).toLocaleString("ar-SY")].map(escapeCsv).join(","));
  lines.push(["المبلغ (ل.س)", Math.round(Number(data.amount))].map(escapeCsv).join(","));
  lines.push(["طريقة التسوية", data.method].map(escapeCsv).join(","));
  lines.push(["تفاصيل الحساب", data.account_details || ""].map(escapeCsv).join(","));
  lines.push(["الحالة", data.status].map(escapeCsv).join(","));
  if (data.admin_note) lines.push(["ملاحظة الإدارة", data.admin_note].map(escapeCsv).join(","));

  const short = String(data.id).slice(0, 8);
  triggerDownload(lines.join("\r\n"), `payout-invoice-${short}.csv`);
}