import * as XLSX from "xlsx";

/** Excel column headers (Arabic, exactly as users will see them) */
export const TEMPLATE_HEADERS: string[] = [
  "اسم المستلم",
  "رقم الهاتف",
  "المحافظة",
  "المنطقة",
  "العنوان التفصيلي",
  "قيمة التحصيل (ل.س)",
  "الكمية",
  "ملاحظات",
];

export type TemplateRow = {
  receiver_name: string;
  phone_number: string;
  province: string;
  district: string;
  detailed_address: string;
  cod_amount: number;
  quantity: number;
  notes: string;
};

/** Build a sample workbook the merchant downloads as a starting point. */
export function buildTemplateWorkbook(): Blob {
  const rows: any[][] = [
    TEMPLATE_HEADERS,
    ["محمد أحمد", "0933123456", "دمشق", "المزة", "شارع الجلاء، بناء 12", 75000, 1, "هش - حذر أثناء النقل"],
    ["سارة علي", "0944556677", "حلب", "السبيل", "حي الشهباء، بناء 5", 120000, 2, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Right-to-left sheet for Arabic
  (ws as any)["!cols"] = [
    { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
    { wch: 36 }, { wch: 18 }, { wch: 8 }, { wch: 26 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "shipments");
  (wb as any).Workbook = { Views: [{ RTL: true }] };
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Parse an uploaded file into raw rows keyed by Arabic header. */
export async function parseUploadedFile(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
}