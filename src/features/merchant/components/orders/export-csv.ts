import { ORDER_STATUS_META } from "@/features/shipments/lib/order-status";

const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();

export interface ExportOrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address?: string | null;
  status: string;
  total_amount: number | null;
  final_sale_price: number | null;
  created_at: string;
  courier?: { name: string | null } | null;
  shipments?: { tracking_number: string | null } | null;
  districts?: { name: string | null } | null;
}

const escapeCsv = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function exportOrdersToCsv(rows: ExportOrderRow[], filenamePrefix = "orders") {
  const header = [
    "كود صِلة",
    "تاريخ الإنشاء",
    "اسم الزبون",
    "رقم الهاتف",
    "المحافظة",
    "المنطقة",
    "العنوان",
    "الحالة",
    "شركة الشحن",
    "رقم التتبع",
    "المبلغ الإجمالي",
  ];
  const lines: string[] = [header.map(escapeCsv).join(",")];
  for (const o of rows) {
    const amount = Number(o.final_sale_price ?? o.total_amount ?? 0);
    const statusLabel = ORDER_STATUS_META[o.status]?.label || o.status;
    const date = new Date(o.created_at).toLocaleString("ar-SY");
    lines.push(
      [
        silaCodeOf(o.id),
        date,
        o.receiver_name,
        o.phone_number,
        o.city,
        o.districts?.name ?? "",
        o.detailed_address ?? "",
        statusLabel,
        o.courier?.name ?? "",
        o.shipments?.tracking_number ?? "",
        amount,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  // BOM for Excel Arabic support
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}