import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, MapPin, Phone, Building2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LocationPicker from "@/components/LocationPicker";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

interface Branch {
  id: string;
  courier_id: string;
  name: string;
  province_id: string | null;
  district_id: string | null;
  address_details: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  is_active: boolean;
}

interface CourierLite { id: string; name: string }
interface ProvinceLite { id: string; name_ar: string }
interface DistrictLite { id: string; name: string; parent_id: string | null; province_ar: string }

// Numeric ID -> Province Arabic name (fallback mapping for Excel files using short numeric IDs)
const NUMERIC_PROVINCE_MAP: Record<string, string> = {
  "1": "دمشق",
  "2": "ريف دمشق",
  "3": "حلب",
  "4": "حمص",
  "5": "حماة",
  "6": "اللاذقية",
  "7": "طرطوس",
  "8": "درعا",
  "9": "السويداء",
  "14": "إدلب",
};

// Normalize Arabic text for fuzzy matching: strip diacritics, unify alef/yaa/taa marbuta, collapse spaces
const normalizeAr = (s: string) =>
  (s || "")
    .toString()
    .replace(/[\u064B-\u0652\u0670]/g, "") // tashkeel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF\w]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ImportRow = {
  province_id: string;       // resolved UUID (may be empty if unresolved)
  district_id: string;       // resolved UUID (may be empty)
  branch_name: string;
  address_details: string;
  phone: string;
  lat: string;
  lng: string;
  _raw_province: string;
  _raw_district: string;
  _raw_area: string;
  _status: "ready" | "warn" | "error";
  _message?: string;
};

const emptyForm = {
  id: "" as string,
  courier_id: "",
  name: "",
  province_id: "",
  district_id: "",
  address_details: "",
  lat: null as number | null,
  lng: null as number | null,
  phone: "",
  is_active: true,
};

export default function AdminBranchesManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<CourierLite[]>([]);
  const [provinces, setProvinces] = useState<ProvinceLite[]>([]);
  const [districts, setDistricts] = useState<DistrictLite[]>([]);
  const [loading, setLoading] = useState(true);
  // ===== Persisted UI state =====
  // Survives tab switches inside /admin and page refreshes within the same session,
  // so an in-progress branch edit is not lost when the admin briefly visits another tab.
  const SS_KEY = "admin-branches-ui";
  type Persisted = {
    search: string;
    filterCourier: string;
    dialogOpen: boolean;
    form: typeof emptyForm;
  };
  const readPersisted = (): Persisted => {
    if (typeof window === "undefined") {
      return { search: "", filterCourier: "all", dialogOpen: false, form: { ...emptyForm } };
    }
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        return {
          search: p.search ?? "",
          filterCourier: p.filterCourier ?? "all",
          dialogOpen: !!p.dialogOpen,
          form: { ...emptyForm, ...(p.form || {}) },
        };
      }
    } catch { /* ignore */ }
    return { search: "", filterCourier: "all", dialogOpen: false, form: { ...emptyForm } };
  };
  const initial = readPersisted();
  const [search, setSearch] = useState(initial.search);
  const [filterCourier, setFilterCourier] = useState<string>(initial.filterCourier);
  const [dialogOpen, setDialogOpen] = useState(initial.dialogOpen);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...initial.form });
  const isEdit = !!form.id;

  // Persist UI state on every relevant change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Persisted = { search, filterCourier, dialogOpen, form };
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  }, [search, filterCourier, dialogOpen, form]);
  const clearDraft = () => {
    setDialogOpen(false);
    setForm({ ...emptyForm });
  };

  // ===== Bulk Import State =====
  const [importOpen, setImportOpen] = useState(false);
  const [importCourier, setImportCourier] = useState<string>("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [bRes, cRes, pRes, dRes] = await Promise.all([
      supabase.from("courier_branches").select("*").order("created_at", { ascending: false }),
      supabase.from("couriers").select("id, name").order("name"),
      supabase.from("provinces").select("id, name_ar").order("name_ar"),
      supabase.from("districts").select("id, name, parent_id, province_ar").order("name"),
    ]);
    if (bRes.data) setBranches(bRes.data as Branch[]);
    if (cRes.data) setCouriers(cRes.data as CourierLite[]);
    if (pRes.data) setProvinces(pRes.data as ProvinceLite[]);
    if (dRes.data) setDistricts(dRes.data as DistrictLite[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const courierName = (id: string) => couriers.find(c => c.id === id)?.name || "—";
  const provinceName = (id: string | null) => id ? (provinces.find(p => p.id === id)?.name_ar || "—") : "—";
  const districtName = (id: string | null) => id ? (districts.find(d => d.id === id)?.name || "—") : "—";

  // Districts filtered by selected province (matching by Arabic province name)
  const districtsForForm = useMemo(() => {
    if (!form.province_id) return [];
    const provAr = provinces.find(p => p.id === form.province_id)?.name_ar;
    if (!provAr) return [];
    return districts.filter(d => d.province_ar === provAr);
  }, [form.province_id, districts, provinces]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter(b => {
      if (filterCourier !== "all" && b.courier_id !== filterCourier) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.address_details || "").toLowerCase().includes(q) ||
        courierName(b.courier_id).toLowerCase().includes(q)
      );
    });
  }, [branches, search, filterCourier, couriers]);

  const openCreate = () => { setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (b: Branch) => {
    setForm({
      id: b.id,
      courier_id: b.courier_id,
      name: b.name,
      province_id: b.province_id || "",
      district_id: b.district_id || "",
      address_details: b.address_details || "",
      lat: b.lat,
      lng: b.lng,
      phone: b.phone || "",
      is_active: b.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.courier_id) { toast.error("اختر شركة الشحن"); return; }
    if (!form.name.trim()) { toast.error("اسم الفرع مطلوب"); return; }
    setSaving(true);
    const payload = {
      courier_id: form.courier_id,
      name: form.name.trim(),
      province_id: form.province_id || null,
      district_id: form.district_id || null,
      address_details: form.address_details.trim() || null,
      lat: form.lat,
      lng: form.lng,
      phone: form.phone.trim() || null,
      is_active: form.is_active,
    };
    const { error } = isEdit
      ? await supabase.from("courier_branches").update(payload).eq("id", form.id)
      : await supabase.from("courier_branches").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "تم تحديث الفرع" : "تم إنشاء الفرع");
    clearDraft();
    fetchAll();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courier_branches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الفرع");
    fetchAll();
  };

  // ===== Bulk Import Logic =====
  const provinceIds = useMemo(() => new Set(provinces.map(p => p.id)), [provinces]);
  const districtIds = useMemo(() => new Set(districts.map(d => d.id)), [districts]);

  // Index: normalized province name_ar -> UUID
  const provinceByName = useMemo(() => {
    const m = new Map<string, string>();
    provinces.forEach(p => m.set(normalizeAr(p.name_ar), p.id));
    return m;
  }, [provinces]);

  // Index: normalized district name -> [{id, province_ar}]
  const districtIndex = useMemo(() => {
    const m = new Map<string, Array<{ id: string; province_ar: string }>>();
    districts.forEach(d => {
      const k = normalizeAr(d.name);
      const arr = m.get(k) || [];
      arr.push({ id: d.id, province_ar: d.province_ar });
      m.set(k, arr);
    });
    return m;
  }, [districts]);

  const courierNameById = (id: string) => couriers.find(c => c.id === id)?.name || "";

  // Resolve a raw province cell (UUID, numeric ID, or Arabic name) -> UUID or ""
  const resolveProvince = (rawId: string, rawName: string): string => {
    const v = (rawId || "").toString().trim();
    if (v && UUID_RE.test(v) && provinceIds.has(v)) return v;
    // Numeric short ID fallback
    if (v && NUMERIC_PROVINCE_MAP[v]) {
      const arName = NUMERIC_PROVINCE_MAP[v];
      const id = provinceByName.get(normalizeAr(arName));
      if (id) return id;
    }
    // Try name matching on the id column itself
    if (v) {
      const id = provinceByName.get(normalizeAr(v));
      if (id) return id;
    }
    // Try the Arabic-name column
    const n = (rawName || "").toString().trim();
    if (n) {
      const id = provinceByName.get(normalizeAr(n));
      if (id) return id;
      // Common alias: "ريف طرطوس" -> طرطوس, "صافيتا" -> طرطوس (governorate fallback)
      const norm = normalizeAr(n);
      if (norm.includes("طرطوس")) return provinceByName.get(normalizeAr("طرطوس")) || "";
      if (norm.includes("دمشق")) return provinceByName.get(normalizeAr("ريف دمشق")) || provinceByName.get(normalizeAr("دمشق")) || "";
    }
    return "";
  };

  // Resolve district within a given province
  const resolveDistrict = (rawId: string, rawArea: string, provinceUuid: string): string => {
    const v = (rawId || "").toString().trim();
    if (v && UUID_RE.test(v) && districtIds.has(v)) return v;
    const provAr = provinces.find(p => p.id === provinceUuid)?.name_ar;
    const area = (rawArea || "").toString().trim();
    if (!area || !provAr) return "";
    const candidates = districtIndex.get(normalizeAr(area));
    if (!candidates || candidates.length === 0) {
      // Fuzzy contains: find any district whose name includes the area or vice versa
      const areaN = normalizeAr(area);
      const hit = districts.find(d =>
        d.province_ar === provAr &&
        (normalizeAr(d.name).includes(areaN) || areaN.includes(normalizeAr(d.name)))
      );
      return hit?.id || "";
    }
    const inProv = candidates.find(c => c.province_ar === provAr);
    return inProv?.id || "";
  };

  // Read .xlsx OR .csv into row objects
  const readWorkbook = async (file: File): Promise<Record<string, any>[]> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });
  };

  const buildRows = (raw: Record<string, any>[], courierId: string): ImportRow[] => {
    const cName = courierNameById(courierId) || "فرع";
    const get = (row: Record<string, any>, ...keys: string[]): string => {
      for (const k of keys) {
        // try exact, lower, trimmed variants
        const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
        if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
          return String(row[found]).trim();
        }
      }
      return "";
    };
    return raw.map<ImportRow>((row) => {
      const rawProvinceId = get(row, "province_id");
      const rawProvinceName = get(row, "المحافظة", "province", "province_ar");
      const rawDistrictId = get(row, "district_id");
      const rawArea = get(row, "المنطقة", "area", "district", "district_ar");
      const rawBranchName = get(row, "branch_name", "اسم الفرع", "name");
      const address = get(row, "العنوان التفصيلي", "address_details", "address");
      const phone = get(row, "رقم الهاتف", "phone", "tel");
      const lat = get(row, "latitude", "lat");
      const lng = get(row, "longitude", "lng", "long");

      const provinceUuid = resolveProvince(rawProvinceId, rawProvinceName);
      const districtUuid = provinceUuid ? resolveDistrict(rawDistrictId, rawArea, provinceUuid) : "";
      const branch_name = rawBranchName || (rawArea ? `${cName} - ${rawArea}` : "");

      let status: ImportRow["_status"] = "ready";
      let message: string | undefined;

      if (!provinceUuid) {
        status = "error";
        message = "تعذّر التعرّف على المحافظة";
      } else if (!branch_name) {
        status = "error";
        message = "اسم الفرع مفقود ولا يمكن توليده";
      } else if (lat && isNaN(Number(lat))) {
        status = "error";
        message = "خط العرض غير صالح";
      } else if (lng && isNaN(Number(lng))) {
        status = "error";
        message = "خط الطول غير صالح";
      } else if (!districtUuid) {
        status = "warn";
        message = "بدون منطقة (سيتم الإدراج على مستوى المحافظة فقط)";
      }

      return {
        province_id: provinceUuid,
        district_id: districtUuid,
        branch_name,
        address_details: address,
        phone,
        lat,
        lng,
        _raw_province: rawProvinceName || rawProvinceId,
        _raw_district: rawDistrictId,
        _raw_area: rawArea,
        _status: status,
        _message: message,
      };
    });
  };

  const onCsvFile = async (file: File) => {
    if (!importCourier) {
      toast.error("اختر شركة الشحن أولاً قبل رفع الملف");
      return;
    }
    try {
      const raw = await readWorkbook(file);
      if (!raw.length) { toast.error("الملف فارغ أو غير قابل للقراءة"); return; }
      const rows = buildRows(raw, importCourier);
      setImportRows(rows);
      const ok = rows.filter(r => r._status === "ready").length;
      const warn = rows.filter(r => r._status === "warn").length;
      const err = rows.filter(r => r._status === "error").length;
      toast.success(`تم تحليل ${rows.length} سطر — ${ok} جاهز، ${warn} تحذير، ${err} خطأ`);
    } catch (e: any) {
      toast.error("فشل قراءة الملف: " + (e?.message || ""));
    }
  };

  // Re-resolve when courier changes (auto branch naming depends on courier name)
  useEffect(() => {
    if (importRows.length === 0 || !importCourier) return;
    // Rebuild names that were auto-generated (branches without an explicit branch_name source)
    const cName = courierNameById(importCourier);
    setImportRows(prev => prev.map(r => {
      if (r._raw_area && r.branch_name.includes(" - ") && cName) {
        return { ...r, branch_name: `${cName} - ${r._raw_area}` };
      }
      return r;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importCourier]);

  const downloadTemplate = () => {
    const data = [
      ["province_id", "district_id", "branch_name", "المحافظة", "المنطقة", "العنوان التفصيلي", "رقم الهاتف", "latitude", "longitude"],
      ["3", "", "", "حلب", "بستان الباشا", "جانب مشفى الحميات", "0999999999", "36.2021", "37.1343"],
      ["1", "", "فرع برامكة", "دمشق", "برامكة", "دوار الحلبوني", "0989555835", "33.5138", "36.2765"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branches");
    XLSX.writeFile(wb, "branches_template.xlsx");
  };

  const confirmImport = async () => {
    if (!importCourier) { toast.error("اختر شركة الشحن أولاً"); return; }
    const valid = importRows.filter(r => r._status !== "error");
    if (valid.length === 0) { toast.error("لا توجد صفوف صالحة للاستيراد"); return; }
    setImporting(true);
    const payload = valid.map(r => ({
      courier_id: importCourier,
      name: r.branch_name.trim(),
      province_id: r.province_id || null,
      district_id: r.district_id || null,
      address_details: r.address_details.trim() || null,
      phone: r.phone.trim() || null,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      is_active: true,
    }));
    const { error } = await supabase.from("courier_branches").insert(payload);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم استيراد ${payload.length} فرع بنجاح`);
    setImportOpen(false);
    setImportRows([]);
    setImportCourier("");
    fetchAll();
  };

  const toggleActive = async (b: Branch) => {
    const { error } = await supabase.from("courier_branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    setBranches(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الفرع أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filterCourier} onValueChange={setFilterCourier}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="جميع شركات الشحن" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع شركات الشحن</SelectItem>
            {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة فرع
        </Button>
        <Button onClick={() => setImportOpen(true)} variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> استيراد Excel/CSV
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              لا توجد فروع مسجّلة بعد
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">شركة الشحن</TableHead>
                  <TableHead className="text-right">المحافظة</TableHead>
                  <TableHead className="text-right">المنطقة</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">إحداثيات</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{b.name}</div>
                      {b.address_details && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{b.address_details}</div>
                      )}
                    </TableCell>
                    <TableCell>{courierName(b.courier_id)}</TableCell>
                    <TableCell>{provinceName(b.province_id)}</TableCell>
                    <TableCell>{districtName(b.district_id)}</TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {b.phone ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" /> {b.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {b.lat != null && b.lng != null ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                          <MapPin className="h-3 w-3" />
                          {b.lat.toFixed(3)}, {b.lng.toFixed(3)}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs">بدون موقع</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                        <span className="text-xs text-muted-foreground">
                          {b.is_active ? "مفعّل" : "موقوف"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الفرع؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف الفرع "{b.name}" نهائياً. لا يمكن التراجع.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(b.id)} className="bg-destructive">
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) clearDraft(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "تعديل فرع" : "إضافة فرع جديد"}</DialogTitle>
            <DialogDescription>
              حدّد بيانات الفرع وضع الدبوس على الخريطة لتحديد إحداثياته.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>شركة الشحن *</Label>
              <Select value={form.courier_id} onValueChange={(v) => setForm({ ...form, courier_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر شركة الشحن" /></SelectTrigger>
                <SelectContent>
                  {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>اسم الفرع *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: فرع المزة" />
            </div>

            <div className="space-y-1.5">
              <Label>المحافظة</Label>
              <Select
                value={form.province_id}
                onValueChange={(v) => setForm({ ...form, province_id: v, district_id: "" })}
              >
                <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                <SelectContent>
                  {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>المنطقة</Label>
              <Select
                value={form.district_id}
                onValueChange={(v) => setForm({ ...form, district_id: v })}
                disabled={!form.province_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.province_id ? "اختر المنطقة" : "اختر المحافظة أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {districtsForForm.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>العنوان التفصيلي</Label>
              <Input
                value={form.address_details}
                onChange={(e) => setForm({ ...form, address_details: e.target.value })}
                placeholder="الشارع، المعالم القريبة..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="09xxxxxxxx"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <span className="text-sm">{form.is_active ? "مفعّل" : "موقوف"}</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <LocationPicker
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) => setForm({ ...form, lat, lng })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={clearDraft}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              {isEdit ? "حفظ التعديلات" : "إضافة الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Bulk Import Dialog (Excel + CSV) ===== */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportRows([]); setImportCourier(""); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> استيراد فروع من Excel / CSV
            </DialogTitle>
            <DialogDescription>
              يقبل الملف صيغ متعددة: <code>province_id</code> كـ UUID أو رقم مختصر (1=دمشق، 3=حلب، 6=اللاذقية...)، أو اسم المحافظة العربي. أعمدة المنطقة والهاتف والإحداثيات اختيارية ويتم استنتاجها تلقائياً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>شركة الشحن (تُطبَّق على جميع الفروع المستوردة) *</Label>
                <Select value={importCourier} onValueChange={setImportCourier}>
                  <SelectTrigger><SelectValue placeholder="اختر شركة الشحن" /></SelectTrigger>
                  <SelectContent>
                    {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ملف Excel (.xlsx) أو CSV</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>قالب</Button>
                </div>
              </div>
            </div>

            {importRows.length > 0 && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    جاهز: {importRows.filter(r => r._status === "ready").length}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    تحذير: {importRows.filter(r => r._status === "warn").length}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="h-3 w-3 text-destructive" />
                    خطأ: {importRows.filter(r => r._status === "error").length}
                  </Badge>
                  <Badge variant="outline">المجموع: {importRows.length}</Badge>
                </div>

                <div className="border border-border rounded-md max-h-[50vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">#</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">المحافظة</TableHead>
                        <TableHead className="text-right">المنطقة</TableHead>
                        <TableHead className="text-right">الهاتف</TableHead>
                        <TableHead className="text-right">إحداثيات</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((r, i) => (
                        <TableRow
                          key={i}
                          className={
                            r._status === "error" ? "bg-destructive/10"
                            : r._status === "warn" ? "bg-amber-500/10"
                            : "bg-green-500/5"
                          }
                        >
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{r.branch_name || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.province_id ? provinceName(r.province_id) : <span className="text-destructive">{r._raw_province || "—"}</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.district_id
                              ? districtName(r.district_id)
                              : <span className="text-amber-600">{r._raw_area || "—"}</span>}
                          </TableCell>
                          <TableCell className="text-xs" dir="ltr">{r.phone || "—"}</TableCell>
                          <TableCell className="text-xs" dir="ltr">{r.lat && r.lng ? `${r.lat}, ${r.lng}` : "—"}</TableCell>
                          <TableCell>
                            {r._status === "ready" && (
                              <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px]">جاهز</Badge>
                            )}
                            {r._status === "warn" && (
                              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]" title={r._message}>
                                بدون منطقة
                              </Badge>
                            )}
                            {r._status === "error" && (
                              <Badge variant="outline" className="text-destructive text-[10px]">{r._message}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>إلغاء</Button>
            <Button
              onClick={confirmImport}
              disabled={importing || !importCourier || importRows.filter(r => r._status !== "error").length === 0}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد وحفظ ({importRows.filter(r => r._status !== "error").length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}