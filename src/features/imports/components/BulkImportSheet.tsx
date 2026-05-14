import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";
import { buildTemplateWorkbook, parseUploadedFile, TEMPLATE_HEADERS } from "@/features/imports/lib/template";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted: () => void;
}

interface DistrictRow {
  id: string;
  name: string;
  parent_id: string | null;
  province_ar: string;
}

interface ParsedRow {
  rowIndex: number; // 1-based (excludes header)
  receiver_name: string;
  phone_number: string;
  province: string;
  district: string;
  detailed_address: string;
  cod_amount: number;
  quantity: number;
  notes: string;
  district_id: string | null;
  province_ar_resolved: string | null;
  errors: string[];
}

const REQUIRED_HEADERS = TEMPLATE_HEADERS.slice(0, 6); // first 6 are required

export default function BulkImportSheet({ open, onOpenChange, onCompleted }: Props) {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [maxRows, setMaxRows] = useState<number>(500);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: d }, { data: s }] = await Promise.all([
        supabase.from("districts").select("id,name,parent_id,province_ar").eq("is_active", true),
        supabase.from("platform_settings").select("bulk_import_max_rows").maybeSingle(),
      ]);
      if (d) setDistricts(d as any);
      if (s?.bulk_import_max_rows) setMaxRows(Number(s.bulk_import_max_rows));
    })();
  }, [open]);

  const provinces = useMemo(
    () => districts.filter(d => !d.parent_id),
    [districts]
  );

  const reset = () => { setFile(null); setRows([]); };

  const onDownloadTemplate = () => {
    const blob = buildTemplateWorkbook();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sila-shipments-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateAndParse = async (f: File) => {
    setParsing(true);
    try {
      const raw = await parseUploadedFile(f);
      if (raw.length === 0) {
        toast.error("الملف فارغ أو لا يحتوي بيانات");
        return;
      }
      if (raw.length > maxRows) {
        toast.error(`الحد الأقصى ${maxRows} صف لكل ملف`);
        return;
      }
      // Verify required headers exist
      const headers = Object.keys(raw[0]);
      const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missing.length > 0) {
        toast.error(`أعمدة ناقصة: ${missing.join("، ")}`);
        return;
      }

      const parsed: ParsedRow[] = raw.map((r, idx) => {
        const receiver_name = String(r["اسم المستلم"] ?? "").trim();
        const phone_number = String(r["رقم الهاتف"] ?? "").trim();
        const province = String(r["المحافظة"] ?? "").trim();
        const district = String(r["المنطقة"] ?? "").trim();
        const detailed_address = String(r["العنوان التفصيلي"] ?? "").trim();
        const codRaw = r["قيمة التحصيل (ل.س)"];
        const cod_amount = Number(String(codRaw ?? "0").replace(/[^\d.-]/g, ""));
        const qtyRaw = r["الكمية"];
        const quantity = Math.max(1, parseInt(String(qtyRaw ?? "1"), 10) || 1);
        const notes = String(r["ملاحظات"] ?? "").trim();

        const errors: string[] = [];
        if (!receiver_name) errors.push("اسم المستلم مفقود");
        if (!phone_number) errors.push("رقم الهاتف مفقود");
        else if (!isValidSyrianPhone(phone_number)) errors.push("رقم الهاتف غير صحيح");
        if (!province) errors.push("المحافظة مفقودة");
        if (!detailed_address) errors.push("العنوان التفصيلي مفقود");
        if (!Number.isFinite(cod_amount) || cod_amount < 0) errors.push("قيمة التحصيل غير صحيحة");

        // Resolve province
        let province_ar_resolved: string | null = null;
        let province_id: string | null = null;
        if (province) {
          const p = provinces.find(
            x => x.province_ar === province || x.name?.toLowerCase() === province.toLowerCase()
          );
          if (!p) errors.push(`المحافظة "${province}" غير معروفة`);
          else {
            province_id = p.id;
            province_ar_resolved = p.province_ar;
          }
        }

        // Resolve district (optional but if given must match)
        let district_id: string | null = null;
        if (province_id) {
          if (district) {
            const d = districts.find(
              x => x.parent_id === province_id &&
                (x.name === district || x.name?.toLowerCase() === district.toLowerCase())
            );
            if (!d) errors.push(`المنطقة "${district}" غير معروفة في ${province_ar_resolved}`);
            else district_id = d.id;
          } else {
            // fallback to province record
            district_id = province_id;
          }
        }

        return {
          rowIndex: idx + 2, // +2 to account for header row in Excel
          receiver_name,
          phone_number,
          province,
          district,
          detailed_address,
          cod_amount,
          quantity,
          notes,
          district_id,
          province_ar_resolved,
          errors,
        };
      });

      setFile(f);
      setRows(parsed);
    } finally {
      setParsing(false);
    }
  };

  const validRows = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);

  const onConfirm = async () => {
    if (!user || validRows.length === 0) return;
    setSubmitting(true);
    try {
      // 1) create job
      const { data: job, error: jobErr } = await supabase
        .from("bulk_import_jobs")
        .insert({
          merchant_id: user.id,
          file_name: file?.name || "import.xlsx",
          total_rows: rows.length,
          status: "processing",
        })
        .select()
        .single();
      if (jobErr || !job) throw jobErr || new Error("failed to create job");

      // 2) bulk insert orders (no courier yet — merchant promotes to shipment later)
      const payload = validRows.map(r => ({
        merchant_id: user.id,
        receiver_name: r.receiver_name,
        phone_number: r.phone_number,
        city: r.province_ar_resolved!, // resolved Arabic name
        district_id: r.district_id,
        detailed_address: r.detailed_address,
        total_amount: r.cod_amount,
        quantity: r.quantity,
        notes: r.notes || null,
        status: "new",
        platform_fee: 0,
        net_amount: r.cod_amount,
        delivery_fee: 0,
      }));

      const { error: insErr, count } = await supabase
        .from("orders")
        .insert(payload, { count: "exact" });

      const successCount = insErr ? 0 : (count ?? validRows.length);
      const allErrors = invalidRows.map(r => ({
        row: r.rowIndex,
        message: r.errors.join("؛ "),
        data: { receiver_name: r.receiver_name, phone_number: r.phone_number },
      }));
      if (insErr) {
        allErrors.push({ row: 0, message: insErr.message, data: {} as any });
      }

      await supabase.from("bulk_import_jobs").update({
        success_count: successCount,
        error_count: rows.length - successCount,
        status: insErr ? "failed" : "completed",
        errors: allErrors as any,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      if (insErr) {
        toast.error(`فشل الاستيراد: ${insErr.message}`);
      } else {
        toast.success(`تم استيراد ${successCount} طلب بنجاح`);
        onCompleted();
        onOpenChange(false);
        reset();
      }
    } catch (e: any) {
      toast.error(e?.message || "فشل الاستيراد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            استيراد طلبات من Excel
          </SheetTitle>
          <SheetDescription>
            حمّل القالب، عبّئه ببيانات طلباتك، ثم ارفعه. سيتم التحقق من كل صف قبل الإنشاء.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <Card className="bg-muted/40 border-border">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm space-y-1">
                <p className="font-medium">الخطوة 1: حمّل القالب</p>
                <p className="text-muted-foreground text-xs">
                  الحد الأقصى {maxRows} صف لكل ملف. الأعمدة المطلوبة: {REQUIRED_HEADERS.join("، ")}.
                </p>
              </div>
              <Button variant="outline" onClick={onDownloadTemplate} className="gap-2">
                <Download className="h-4 w-4" /> تحميل القالب
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/40 border-border">
            <CardContent className="p-4 space-y-3">
              <p className="font-medium text-sm">الخطوة 2: ارفع الملف المعبّأ</p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={parsing || submitting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) validateAndParse(f);
                }}
              />
              {parsing && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> جاري التحقق…</p>}
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  جاهز للإنشاء: {validRows.length}
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    فيه أخطاء: {invalidRows.length}
                  </Badge>
                )}
                <Badge variant="outline">إجمالي الصفوف: {rows.length}</Badge>
              </div>

              {invalidRows.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    سيتم تجاهل الصفوف التي تحتوي أخطاء. صحّح الملف وأعد رفعه لإدراجها.
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[320px] border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصف</TableHead>
                      <TableHead>المستلم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الوجهة</TableHead>
                      <TableHead>التحصيل</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.rowIndex} className={r.errors.length ? "bg-destructive/5" : ""}>
                        <TableCell>{r.rowIndex}</TableCell>
                        <TableCell>{r.receiver_name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.phone_number || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.province_ar_resolved || r.province || "—"}{r.district ? ` / ${r.district}` : ""}
                        </TableCell>
                        <TableCell>{Number.isFinite(r.cod_amount) ? r.cod_amount.toLocaleString() : "—"}</TableCell>
                        <TableCell>
                          {r.errors.length === 0
                            ? <Badge className="bg-success/15 text-success border-success/30">جاهز</Badge>
                            : <span className="text-xs text-destructive">{r.errors.join("؛ ")}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <SheetFooter className="gap-2 sm:gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>إلغاء</Button>
          <Button
            onClick={onConfirm}
            disabled={validRows.length === 0 || submitting}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" />
            إنشاء {validRows.length} طلب
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}