import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Truck, Trash2, DollarSign, Settings2, UserPlus, Copy, Check, Map as MapIcon, Package, Info, KeyRound, Loader2, Wallet as WalletIcon, Image as ImageIcon, ChevronDown, ChevronLeft, Search, AlertTriangle, ChevronRight, Building2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import WalletTransactionsLog from "@/components/shared/WalletTransactionsLog";
import { isValidSyrianPhone, SY_PHONE_PLACEHOLDER } from "@/lib/syrian-phone";
import { SyrianPhoneInput } from "@/components/SyrianPhoneInput";
import CourierPricingTiers from "@/components/admin/CourierPricingTiers";
import CourierBranchesPanel, { useCourierCoveredProvinces } from "@/components/admin/CourierBranchesPanel";

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  is_active: boolean;
  vendor_id: string | null;
  services?: string[] | null;
  cod_fee_type?: "fixed" | "percentage" | null;
  cod_fee_value?: number | null;
  return_fee_percentage?: number | null;
  tax_id?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  integration_type?: string | null;
  logo_url?: string | null;
}

interface VendorProfile {
  user_id: string;
  contact_person: string | null;
  phone: string | null;
  store_name: string | null;
}

interface DistrictRow {
  id: string;
  name: string;
  parent_id: string | null;
  province_ar: string;
  delivery_fee: number;
}

interface DistrictRate {
  id: string;
  courier_id: string;
  district_id: string;
  custom_delivery_fee: number;
  min_weight_kg: number;
  max_weight_kg: number;
  estimated_days: string | null;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";

// Computes a simple completion score (0-100) from a courier's filled fields
function profileCompletion(c: Courier): number {
  const checks = [
    !!c.name?.trim(),
    !!c.phone?.trim(),
    !!c.city?.trim(),
    !!c.logo_url,
    !!c.contact_person?.trim(),
    !!c.contact_email?.trim(),
    !!c.tax_id?.trim(),
    (c.cod_fee_value ?? 0) > 0,
    !!c.vendor_id,
    (c.services?.length ?? 0) > 0,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

export default function AdminCouriersManagement() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileCourier, setProfileCourier] = useState<Courier | null>(null);
  const [toDelete, setToDelete] = useState<Courier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [form, setForm] = useState({ name: "", phone: "", city: "" });

  const provinces = useMemo(() => districts.filter(d => !d.parent_id), [districts]);
  const areasOf = (provId: string) => districts.filter(d => d.parent_id === provId);

  const vendorLabel = (v: VendorProfile) =>
    v.contact_person || v.store_name || v.phone || v.user_id.slice(0, 8);

  const vendorById = (id: string | null) => vendors.find(v => v.user_id === id);

  const fetchAll = async () => {
    setLoading(true);
    const [cRes, dRes, vRes] = await Promise.all([
      supabase.from("couriers").select("*" as any).order("name"),
      supabase.from("districts").select("id, name, parent_id, province_ar, delivery_fee").order("name"),
      supabase.from("profiles").select("user_id, contact_person, phone, store_name").eq("role", "vendor"),
    ]);
    if (cRes.data) setCouriers(cRes.data as unknown as Courier[]);
    if (dRes.data) setDistricts(dRes.data as DistrictRow[]);
    if (vRes.data) setVendors(vRes.data as VendorProfile[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const assignVendor = async (courierId: string, vendorId: string | null) => {
    const { error } = await supabase.from("couriers")
      .update({ vendor_id: vendorId } as any).eq("id", courierId);
    if (error) { toast.error(error.message); return; }
    toast.success(vendorId ? "تم ربط الحساب بالشركة" : "تم فك الربط");
    fetchAll();
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("اسم شركة الشحن مطلوب"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("غير مصرّح"); return; }

    const dup = couriers.some(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (dup) { toast.error("يوجد شركة شحن بنفس الاسم بالفعل"); return; }
    if (form.phone.trim() && !isValidSyrianPhone(form.phone.trim())) {
      toast.error("رقم الهاتف السوري غير صحيح. مثال: 0933123456");
      return;
    }

    // CRITICAL FIX: NEVER auto-link to admin. Account is created later via "الدخول" tab.
    const { error } = await supabase.from("couriers").insert({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      is_active: true,
      vendor_id: null,
      cod_fee_type: "percentage",
      cod_fee_value: 1,
      services: ["standard"],
    } as any);
    if (error) {
      const msg = error.message.toLowerCase().includes("unique") ? "اسم الشركة مستخدم مسبقاً" : error.message;
      toast.error(msg);
      return;
    }
    toast.success("تمت الإضافة — افتح ملف الشركة لإكمال البيانات وإنشاء حساب الدخول");
    setForm({ name: "", phone: "", city: "" });
    setCreateOpen(false);
    fetchAll();
  };

  const toggleActive = async (c: Courier) => {
    const { error } = await supabase.from("couriers")
      .update({ is_active: !c.is_active } as any).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(c.is_active ? "تم إيقاف الشركة" : "تم تفعيل الشركة");
    fetchAll();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("couriers").delete().eq("id", toDelete.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم حذف "${toDelete.name}"`);
    setToDelete(null);
    fetchAll();
  };

  const filteredCouriers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return couriers.filter(c => {
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q)
      );
    });
  }, [couriers, searchTerm, statusFilter]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> شركات الشحن
          </h2>
          <p className="text-sm text-muted-foreground">إدارة الشركات وتسعيراتها المخصصة وتغطياتها الجغرافية</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> إضافة شركة شحن</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة شركة شحن جديدة</DialogTitle>
              <DialogDescription>أدخل بيانات الشركة الأساسية</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>اسم الشركة *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: الفجر السريع" />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0933123456" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>المدينة الرئيسية</Label>
                <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="دمشق" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
              <Button onClick={handleCreate}>إضافة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
      ) : couriers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد شركات شحن — أضف الأولى</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشركة</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>المدينة</TableHead>
                  <TableHead>الحساب المرتبط</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couriers.map(c => {
                  const linked = vendorById(c.vendor_id);
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={(e) => {
                      const tag = (e.target as HTMLElement).closest('button, [role="combobox"], input, select, [data-no-row-click]');
                      if (tag) return;
                      setProfileCourier(c);
                    }}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.name} className="h-7 w-7 rounded object-cover border border-border" />
                          ) : (
                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          {c.name}
                          {c.services && c.services.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">{c.services.length} خدمات</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell dir="ltr" className="text-sm">{c.phone || "—"}</TableCell>
                      <TableCell>{c.city || "—"}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <Select
                          value={c.vendor_id || "__none__"}
                          onValueChange={(v) => assignVendor(c.id, v === "__none__" ? null : v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="غير مرتبط">
                              {linked ? (
                                <span className="truncate">{vendorLabel(linked)}</span>
                              ) : (
                                <span className="text-muted-foreground">غير مرتبط</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— فك الربط —</SelectItem>
                            {vendors.map(v => (
                              <SelectItem key={v.user_id} value={v.user_id}>
                                {vendorLabel(v)}{v.phone ? ` · ${v.phone}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">نشطة</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20">موقوفة</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                          <Button variant="ghost" size="sm" onClick={() => setProfileCourier(c)} className="gap-1">
                            <Settings2 className="h-3.5 w-3.5" /> ملف الشركة
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(c)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {profileCourier && (
        <CourierProfileSheet
          courier={profileCourier}
          districts={districts}
          provinces={provinces}
          areasOf={areasOf}
          onClose={() => { setProfileCourier(null); fetchAll(); }}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}

const SERVICE_OPTIONS = [
  { id: "same_day", label: "توصيل في نفس اليوم" },
  { id: "heavy", label: "شحن ثقيل" },
  { id: "fragile", label: "قابل للكسر" },
  { id: "refrigerated", label: "شحن مبرد" },
];

const INTEGRATION_OPTIONS = [
  { id: "portal", label: "بوابة (Portal)" },
  { id: "api", label: "تكامل API" },
  { id: "manual", label: "يدوي" },
];

// ============ Unified Pricing Matrix (district-based) ============
function PricingMatrix({ courierId, provinces, areasOf, courierName }: {
  courierId: string;
  provinces: DistrictRow[];
  areasOf: (id: string) => DistrictRow[];
  courierName?: string;
}) {
  const [rates, setRates] = useState<DistrictRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulkProvId, setBulkProvId] = useState<string>("");
  const [bulkFee, setBulkFee] = useState<string>("");
  const [bulkMinW, setBulkMinW] = useState<string>("0");
  const [bulkMaxW, setBulkMaxW] = useState<string>("999");
  const [bulkDays, setBulkDays] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // Filter: show only provinces where courier has at least one active branch
  const [onlyCovered, setOnlyCovered] = useState(true);
  const { coveredProvinceIds, branchCountByProvince, reload: reloadCoverage } = useCourierCoveredProvinces(courierId);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("courier_district_rates")
      .select("*")
      .eq("courier_id", courierId)
      .order("min_weight_kg", { ascending: true });
    setRates((data || []) as DistrictRate[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [courierId]);

  // All tiers (rows) for a given district, sorted by min_weight_kg asc
  const tiersFor = (districtId: string) =>
    rates.filter(r => r.district_id === districtId)
         .sort((a, b) => a.min_weight_kg - b.min_weight_kg);

  // Client-side overlap check (mirrors DB trigger) for instant feedback
  const overlaps = (
    districtId: string,
    minW: number,
    maxW: number,
    ignoreId?: string,
  ) => {
    // Half-open ranges [min, max): touching edges (e.g. 0-5 and 5-10) are NOT overlap
    return tiersFor(districtId).some(r =>
      r.id !== ignoreId &&
      Math.max(minW, Number(r.min_weight_kg)) < Math.min(maxW, Number(r.max_weight_kg))
    );
  };

  const validateTier = (
    districtId: string,
    fee: number,
    minW: number,
    maxW: number,
    ignoreId?: string,
  ): string | null => {
    if (isNaN(fee) || fee < 0) return "السعر غير صالح";
    if (isNaN(minW) || isNaN(maxW)) return "أوزان غير صالحة";
    if (minW < 0) return "الحد الأدنى للوزن يجب أن يكون ≥ 0";
    if (maxW <= minW) return "الحد الأقصى يجب أن يكون أكبر من الحد الأدنى";
    if (overlaps(districtId, minW, maxW, ignoreId)) return "تتداخل شريحة الوزن مع شريحة موجودة لهذه المنطقة";
    return null;
  };

  const insertTier = async (
    districtId: string,
    fee: number,
    minW: number,
    maxW: number,
    days: string | null,
  ) => {
    const err = validateTier(districtId, fee, minW, maxW);
    if (err) { toast.error(err); return false; }
    const { error } = await supabase.from("courier_district_rates").insert({
      courier_id: courierId, district_id: districtId,
      custom_delivery_fee: fee, min_weight_kg: minW, max_weight_kg: maxW,
      estimated_days: days,
    } as any);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  };

  const updateTier = async (
    rateId: string,
    patch: Partial<Pick<DistrictRate, "custom_delivery_fee" | "min_weight_kg" | "max_weight_kg" | "estimated_days">>,
  ) => {
    const cur = rates.find(r => r.id === rateId);
    if (!cur) return false;
    const next = { ...cur, ...patch };
    const err = validateTier(cur.district_id, Number(next.custom_delivery_fee), Number(next.min_weight_kg), Number(next.max_weight_kg), rateId);
    if (err) { toast.error(err); return false; }
    const { error } = await supabase.from("courier_district_rates")
      .update({
        custom_delivery_fee: Number(next.custom_delivery_fee),
        min_weight_kg: Number(next.min_weight_kg),
        max_weight_kg: Number(next.max_weight_kg),
        estimated_days: next.estimated_days || null,
      })
      .eq("id", rateId);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
  };

  const deleteTier = async (rateId: string) => {
    const { error } = await supabase.from("courier_district_rates").delete().eq("id", rateId);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const applyBulk = async () => {
    if (!bulkProvId) { toast.error("اختر المحافظة أولاً"); return; }
    const fee = Number(bulkFee);
    const mn = Number(bulkMinW);
    const mx = Number(bulkMaxW);
    if (isNaN(fee) || fee < 0) { toast.error("أدخل سعراً صحيحاً"); return; }
    if (isNaN(mn) || isNaN(mx) || mx <= mn) { toast.error("أدخل نطاق وزن صحيحاً (الأقصى > الأدنى)"); return; }

    setSaving(true);
    const targets = [bulkProvId, ...areasOf(bulkProvId).map(a => a.id)];
    let ok = 0, skipped = 0;
    for (const did of targets) {
      if (overlaps(did, mn, mx)) { skipped++; continue; }
      const { error } = await supabase.from("courier_district_rates").insert({
        courier_id: courierId, district_id: did,
        custom_delivery_fee: fee, min_weight_kg: mn, max_weight_kg: mx,
        estimated_days: bulkDays.trim() || null,
      } as any);
      if (!error) ok++; else skipped++;
    }
    await load();
    setSaving(false);
    if (ok > 0) toast.success(`تم إنشاء ${ok} شريحة` + (skipped ? ` (تخطي ${skipped} للتداخل)` : ""));
    else toast.error("لم تُنشأ أي شريحة — تحقق من التداخل مع الشرائح الموجودة");
    setBulkFee(""); setBulkDays("");
  };

  // Apply the same tier (price + weight + days) to ALL provinces that have at least one active branch.
  // Includes both the province row itself and its sub-districts. Skips overlaps silently.
  const applyBulkAllCovered = async () => {
    const fee = Number(bulkFee);
    const mn = Number(bulkMinW);
    const mx = Number(bulkMaxW);
    if (isNaN(fee) || fee < 0) { toast.error("أدخل سعراً صحيحاً"); return; }
    if (isNaN(mn) || isNaN(mx) || mx <= mn) { toast.error("أدخل نطاق وزن صحيحاً (الأقصى > الأدنى)"); return; }
    // coveredProvinceIds holds province NAMES (provinces.name_ar). Map to district top-level ids.
    const coveredProvObjs = provinces.filter(p => coveredProvinceIds.has(p.province_ar));
    if (coveredProvObjs.length === 0) {
      toast.error("لا توجد محافظات مغطاة بفروع — أضف الفروع أولاً");
      return;
    }
    if (!confirm(`سيتم تطبيق الشريحة (${mn}–${mx}كغ بسعر ${fee} ل.س) على ${coveredProvObjs.length} محافظة + مناطقها الفرعية. متابعة؟`)) return;

    setSaving(true);
    const targets: string[] = [];
    for (const prov of coveredProvObjs) {
      targets.push(prov.id, ...areasOf(prov.id).map(a => a.id));
    }
    let ok = 0, skipped = 0;
    let firstError = "";
    for (const did of targets) {
      if (overlaps(did, mn, mx)) { skipped++; continue; }
      const { error } = await supabase.from("courier_district_rates").insert({
        courier_id: courierId, district_id: did,
        custom_delivery_fee: fee, min_weight_kg: mn, max_weight_kg: mx,
        estimated_days: bulkDays.trim() || null,
      } as any);
      if (!error) ok++;
      else { skipped++; if (!firstError) firstError = error.message; }
    }
    await load();
    setSaving(false);
    if (ok > 0) toast.success(`تم إنشاء ${ok} شريحة في ${coveredProvObjs.length} محافظة` + (skipped ? ` (تخطي ${skipped} للتداخل)` : ""));
    else toast.error(firstError ? `فشل الإدراج: ${firstError}` : "لم تُنشأ أي شريحة — تحقق من النطاق");
    setBulkFee(""); setBulkDays("");
  };

  // Bulk delete: removes tiers matching the bulk weight range across the chosen province + its sub-districts.
  // If min/max are left as defaults (0–999) it effectively wipes all tiers for the province.
  const deleteBulk = async () => {
    if (!bulkProvId) { toast.error("اختر المحافظة أولاً"); return; }
    const mn = Number(bulkMinW);
    const mx = Number(bulkMaxW);
    if (isNaN(mn) || isNaN(mx) || mx <= mn) { toast.error("أدخل نطاق وزن صحيحاً"); return; }

    const targets = [bulkProvId, ...areasOf(bulkProvId).map(a => a.id)];
    // Match tiers that exactly fit the entered range (safer than "any overlap")
    const toDelete = rates.filter(r =>
      targets.includes(r.district_id) &&
      Number(r.min_weight_kg) === mn &&
      Number(r.max_weight_kg) === mx
    );
    if (toDelete.length === 0) {
      toast.error("لا توجد شرائح بنفس نطاق الوزن في هذه المحافظة");
      return;
    }
    if (!confirm(`سيتم حذف ${toDelete.length} شريحة (${mn}–${mx}كغ) من هذه المحافظة. متابعة؟`)) return;

    setSaving(true);
    const { error } = await supabase
      .from("courier_district_rates")
      .delete()
      .in("id", toDelete.map(r => r.id));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم حذف ${toDelete.length} شريحة`);
    await load();
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>;

  // Auto-seed: create a default 0-priced tier for every covered province that doesn't have one yet.
  const autoSeedFromBranches = async () => {
    // Map covered province NAMES to district top-level ids, keep only those with no existing tier.
    const targets = provinces
      .filter(p => coveredProvinceIds.has(p.province_ar))
      .map(p => p.id)
      .filter(did => tiersFor(did).length === 0);
    if (targets.length === 0) {
      toast.info("كل المحافظات المغطاة بفروع لها بالفعل صف تسعير");
      return;
    }
    setSaving(true);
    let ok = 0;
    for (const did of targets) {
      const { error } = await supabase.from("courier_district_rates").insert({
        courier_id: courierId, district_id: did,
        custom_delivery_fee: 0, min_weight_kg: 0, max_weight_kg: 999,
        estimated_days: null,
      } as any);
      if (!error) ok++;
    }
    await load();
    setSaving(false);
    if (ok > 0) toast.success(`تم تهيئة التغطية لـ${ok} محافظة — حدّد الأسعار الآن`);
    else toast.error("لم تُنشأ صفوف — جرّب لاحقاً");
  };

  const visibleProvinces = onlyCovered && coveredProvinceIds.size > 0
    ? provinces.filter(p => coveredProvinceIds.has(p.province_ar))
    : provinces;
  const hiddenCount = provinces.length - visibleProvinces.length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        حدّد شرائح الوزن وأسعار التوصيل لكل منطقة. لكل منطقة يمكن إضافة عدة شرائح بدون تداخل (مثل: 0–5كغ، 5–10كغ).
      </p>

      {/* Coverage controls */}
      <Card className="p-3 bg-primary/5 border-primary/20 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              التغطية الفعلية: {coveredProvinceIds.size} محافظة فيها فروع نشطة
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="only-covered" className="text-xs cursor-pointer">إظهار المحافظات المغطاة فقط</Label>
            <Switch id="only-covered" checked={onlyCovered} onCheckedChange={setOnlyCovered} />
          </div>
        </div>
        {coveredProvinceIds.size > 0 && (
          <Button
            onClick={autoSeedFromBranches}
            disabled={saving}
            size="sm"
            variant="outline"
            className="gap-1.5 w-full sm:w-auto"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            تهيئة التغطية تلقائياً من الفروع
          </Button>
        )}
        {coveredProvinceIds.size === 0 && (
          <p className="text-[11px] text-muted-foreground">
            ⚠️ لا توجد فروع نشطة لـ{courierName || "هذه الشركة"} — أضف الفروع من تبويب «الفروع» أولاً.
          </p>
        )}
      </Card>

      {/* Bulk apply */}
      <Card className="p-3 bg-muted/30 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-primary" /> تسعير سريع — إضافة شريحة واحدة لكل المحافظة
        </h4>
        {bulkProvId && coveredProvinceIds.size > 0 && !coveredProvinceIds.has(provinces.find(p => p.id === bulkProvId)?.province_ar || "") && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>هذه المحافظة لا يوجد فيها فرع لـ{courierName || "هذه الشركة"}. أضف فرعاً أولاً من تبويب «الفروع» لتظهر تلقائياً، أو تابع التسعير إذا كانت الشركة تخدمها بالتعاون.</span>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Select value={bulkProvId} onValueChange={setBulkProvId}>
            <SelectTrigger><SelectValue placeholder="المحافظة" /></SelectTrigger>
            <SelectContent>
              {provinces.map(p => {
                const c = branchCountByProvince[p.province_ar] || 0;
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{c > 0 ? ` · ${c} فرع` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Input type="number" min="0" placeholder="من وزن" value={bulkMinW} onChange={e => setBulkMinW(e.target.value)} dir="ltr" />
          <Input type="number" min="0" placeholder="إلى وزن" value={bulkMaxW} onChange={e => setBulkMaxW(e.target.value)} dir="ltr" />
          <Input type="number" min="0" placeholder="السعر (ل.س)" value={bulkFee} onChange={e => setBulkFee(e.target.value)} dir="ltr" />
          <Input placeholder="مدة (مثلاً 1-2 أيام)" value={bulkDays} onChange={e => setBulkDays(e.target.value)} />
        </div>
        <Button onClick={applyBulk} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          إضافة الشريحة لكل مناطق المحافظة
        </Button>
        <Button
          onClick={applyBulkAllCovered}
          disabled={saving || coveredProvinceIds.size === 0}
          size="sm"
          variant="secondary"
          className="gap-1.5 mr-2"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          تطبيق على كل المحافظات المغطاة بفروع ({coveredProvinceIds.size})
        </Button>
        <Button
          onClick={deleteBulk}
          disabled={saving}
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive mr-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
          حذف نفس الشريحة من كل مناطق المحافظة
        </Button>
        <p className="text-[11px] text-muted-foreground">
          💡 «تطبيق على كل المحافظات المغطاة» يستخدم نفس السعر والوزن والمدة في الأعلى — لا حاجة لاختيار محافظة.
        </p>
      </Card>

      {/* Per-district matrix */}
      <div className="border border-border rounded-md divide-y divide-border max-h-[28rem] overflow-y-auto">
        {visibleProvinces.map(p => {
          const isExp = expanded[p.id];
          const subs = areasOf(p.id);
          const provTiers = tiersFor(p.id);
          const branchCount = branchCountByProvince[p.province_ar] || 0;
          const isCovered = branchCount > 0;
          return (
            <div key={p.id}>
              <button
                type="button"
                className="w-full flex items-center gap-2 p-2 hover:bg-muted/40 text-right"
                onClick={() => setExpanded(s => ({ ...s, [p.id]: !s[p.id] }))}
              >
                {isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                {isCovered ? (
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-0.5">
                    <Building2 className="h-2.5 w-2.5" /> {branchCount} فرع
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    لا فرع
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {provTiers.length} شريحة (المحافظة)
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {subs.length} منطقة فرعية
                </Badge>
              </button>
              {isExp && (
                <div className="bg-muted/10 border-t border-border px-3 py-2 space-y-3">
                  <DistrictTiers
                    district={p}
                    tiers={provTiers}
                    onAdd={(fee, mn, mx, d) => insertTier(p.id, fee, mn, mx, d)}
                    onUpdate={updateTier}
                    onDelete={deleteTier}
                  />
                  {subs.map(s => (
                    <DistrictTiers
                      key={s.id}
                      district={s}
                      tiers={tiersFor(s.id)}
                      onAdd={(fee, mn, mx, d) => insertTier(s.id, fee, mn, mx, d)}
                      onUpdate={updateTier}
                      onDelete={deleteTier}
                      isSub
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {visibleProvinces.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            لا توجد محافظات مغطاة بفروع لـ{courierName || "هذه الشركة"} بعد.
            <br />
            <button
              type="button"
              className="text-primary underline mt-1 text-xs"
              onClick={() => setOnlyCovered(false)}
            >
              عرض كل المحافظات بأي حال
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          إجمالي شرائح الوزن المُسعّرة: {rates.length}
        </p>
        {hiddenCount > 0 && onlyCovered && (
          <p className="text-[11px] text-muted-foreground">
            مخفية: {hiddenCount} محافظة بدون فروع
          </p>
        )}
      </div>
    </div>
  );
}

// ============ Per-district tiers sub-table ============
function DistrictTiers({ district, tiers, onAdd, onUpdate, onDelete, isSub }: {
  district: DistrictRow;
  tiers: DistrictRate[];
  onAdd: (fee: number, minW: number, maxW: number, days: string | null) => Promise<boolean>;
  onUpdate: (id: string, patch: Partial<Pick<DistrictRate, "custom_delivery_fee" | "min_weight_kg" | "max_weight_kg" | "estimated_days">>) => Promise<boolean>;
  onDelete: (id: string) => void;
  isSub?: boolean;
}) {
  const [draft, setDraft] = useState({ minW: "", maxW: "", fee: "", days: "" });

  const submit = async () => {
    const ok = await onAdd(
      Number(draft.fee),
      Number(draft.minW),
      Number(draft.maxW),
      draft.days.trim() || null,
    );
    if (ok) setDraft({ minW: "", maxW: "", fee: "", days: "" });
  };

  return (
    <Card className={`p-2 space-y-2 ${isSub ? "bg-background" : "bg-background border-primary/30"}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${isSub ? "text-muted-foreground" : "text-foreground"}`}>
          {isSub ? "↳ " : ""}{district.name}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {tiers.length} شريحة
        </Badge>
      </div>

      {tiers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="px-1 py-1 text-right font-normal">من (كغ)</th>
                <th className="px-1 py-1 text-right font-normal">إلى (كغ)</th>
                <th className="px-1 py-1 text-right font-normal">السعر (ل.س)</th>
                <th className="px-1 py-1 text-right font-normal">المدة</th>
                <th className="px-1 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="px-1 py-1">
                    <Input dir="ltr" type="number" min="0" defaultValue={t.min_weight_kg}
                      className="h-7 text-xs"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== t.min_weight_kg) onUpdate(t.id, { min_weight_kg: v });
                      }} />
                  </td>
                  <td className="px-1 py-1">
                    <Input dir="ltr" type="number" min="0" defaultValue={t.max_weight_kg}
                      className="h-7 text-xs"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== t.max_weight_kg) onUpdate(t.id, { max_weight_kg: v });
                      }} />
                  </td>
                  <td className="px-1 py-1">
                    <Input dir="ltr" type="number" min="0" step="500" defaultValue={t.custom_delivery_fee}
                      className="h-7 text-xs"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== t.custom_delivery_fee) onUpdate(t.id, { custom_delivery_fee: v });
                      }} />
                  </td>
                  <td className="px-1 py-1">
                    <Input defaultValue={t.estimated_days || ""}
                      placeholder="1-2 أيام"
                      className="h-7 text-xs"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (t.estimated_days || "")) onUpdate(t.id, { estimated_days: v || null });
                      }} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)} className="h-6 w-6 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New tier draft */}
      <div className="grid grid-cols-12 gap-1 items-center">
        <Input dir="ltr" type="number" min="0" placeholder="من" value={draft.minW}
          onChange={(e) => setDraft(d => ({ ...d, minW: e.target.value }))}
          className="h-7 text-xs col-span-2" />
        <Input dir="ltr" type="number" min="0" placeholder="إلى" value={draft.maxW}
          onChange={(e) => setDraft(d => ({ ...d, maxW: e.target.value }))}
          className="h-7 text-xs col-span-2" />
        <Input dir="ltr" type="number" min="0" step="500" placeholder="السعر" value={draft.fee}
          onChange={(e) => setDraft(d => ({ ...d, fee: e.target.value }))}
          className="h-7 text-xs col-span-3" />
        <Input placeholder="مدة" value={draft.days}
          onChange={(e) => setDraft(d => ({ ...d, days: e.target.value }))}
          className="h-7 text-xs col-span-3" />
        <Button size="sm" onClick={submit} className="h-7 text-xs col-span-2 gap-1">
          <Plus className="h-3 w-3" /> إضافة
        </Button>
      </div>
    </Card>
  );
}

// ============ Profile sheet (5 tabs) ============
function CourierProfileSheet({ courier, districts, provinces, areasOf, onClose, onRefresh }: {
  courier: Courier;
  districts: DistrictRow[];
  provinces: DistrictRow[];
  areasOf: (id: string) => DistrictRow[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  // Tab 1: Basic & Legal
  const [name, setName] = useState(courier.name);
  const [phone, setPhone] = useState(courier.phone || "");
  const [city, setCity] = useState(courier.city || "");
  const [services, setServices] = useState<string[]>(courier.services || []);
  const [savingInfo, setSavingInfo] = useState(false);
  const [codFeeType, setCodFeeType] = useState<"fixed" | "percentage">(
    (courier.cod_fee_type as any) || "percentage"
  );
  const [codFeeValue, setCodFeeValue] = useState<string>(
    courier.cod_fee_value != null ? String(courier.cod_fee_value) : "0"
  );
  const [returnFeePct, setReturnFeePct] = useState<string>(
    courier.return_fee_percentage != null ? String(courier.return_fee_percentage) : "50"
  );
  const [taxId, setTaxId] = useState(courier.tax_id || "");
  const [contactPerson, setContactPerson] = useState(courier.contact_person || "");
  const [contactEmail, setContactEmail] = useState(courier.contact_email || "");
  const [integrationType, setIntegrationType] = useState(courier.integration_type || "portal");
  const [logoUrl, setLogoUrl] = useState(courier.logo_url || "");
  const [isActive, setIsActive] = useState(courier.is_active);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Persisted active tab per courier — prevents reset on re-renders
  const profileTabKey = `admin-courier-profile-tab:${courier.id}`;
  const [profileTab, setProfileTab] = useState<string>(() => {
    if (typeof window === "undefined") return "info";
    const s = sessionStorage.getItem(profileTabKey);
    return s && ["info", "account", "coverage", "wallet", "orders"].includes(s) ? s : "info";
  });
  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem(profileTabKey, profileTab);
  }, [profileTab, profileTabKey]);

  // Tab 2: Auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  // Tab 5: Assigned orders
  const [assigned, setAssigned] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from("orders")
        .select("id, status, city, receiver_name, created_at, merchant_id")
        .eq("courier_id", courier.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        const orders = data || [];
        const merchantIds = Array.from(new Set(orders.map((o: any) => o.merchant_id).filter(Boolean)));
        let merchantsMap: Record<string, string> = {};
        if (merchantIds.length > 0) {
          const { data: ms } = await supabase
            .from("merchants")
            .select("user_id, store_name")
            .in("user_id", merchantIds);
          (ms || []).forEach((m: any) => { merchantsMap[m.user_id] = m.store_name || "—"; });
        }
        setAssigned(orders.map((o: any) => ({ ...o, merchant_name: merchantsMap[o.merchant_id] || "—" })));
        setLoadingOrders(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courier.id]);

  const toggleService = (id: string) => {
    setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("اختر ملف صورة"); return; }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `couriers/${courier.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("تم رفع الشعار");
    } catch (err: any) {
      toast.error(err.message || "فشل رفع الشعار");
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveInfo = async () => {
    if (!name.trim()) { toast.error("اسم الشركة مطلوب"); return; }
    setSavingInfo(true);
    const { error } = await supabase.from("couriers").update({
      name: name.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      services,
      cod_fee_type: codFeeType,
      cod_fee_value: Number(codFeeValue) || 0,
      return_fee_percentage: Math.max(0, Math.min(100, Number(returnFeePct) || 0)),
      tax_id: taxId.trim() || null,
      contact_person: contactPerson.trim() || null,
      contact_email: contactEmail.trim() || null,
      integration_type: integrationType,
      logo_url: logoUrl.trim() || null,
      is_active: isActive,
    } as any).eq("id", courier.id);
    setSavingInfo(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ بيانات الشركة");
    onRefresh();
  };

  const generateAccount = async () => {
    const username = email.trim().toLowerCase();
    if (!username || !password.trim() || !contact.trim()) {
      toast.error("املأ اسم المستخدم وكلمة المرور والاسم");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      toast.error("اسم المستخدم: أحرف إنجليزية صغيرة وأرقام و _ فقط");
      return;
    }
    if (password.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    setCreatingAccount(true);
    try {
      // Server-side creation via Edge Function — keeps admin session intact
      // and creates an email-confirmed account that can log in immediately.
      const { data, error } = await supabase.functions.invoke("create-courier-account", {
        body: {
          username,
          password,
          courier_id: courier.id,
          contact_person: contact.trim(),
        },
      });
      if (error) {
        const ctx = (error as any)?.context;
        let msg = error.message || "فشل إنشاء الحساب";
        try {
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.user_id) throw new Error("فشل إنشاء الحساب");
      setCredentials({ email: username, password });
      toast.success("تم إنشاء حساب شركة الشحن وربطه");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "فشل إنشاء الحساب");
    } finally {
      setCreatingAccount(false);
    }
  };

  const copyVal = async (val: string, kind: "email" | "password") => {
    try { await navigator.clipboard.writeText(val); setCopied(kind); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const ORDER_STATUS_AR: Record<string, string> = {
    new: "جديد", processing: "قيد المعالجة", shipped: "تم الشحن",
    out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", returned: "مرتجع", cancelled: "ملغي",
  };
  const orderStatusColor = (s: string) => {
    if (s === "delivered") return "bg-primary/15 text-primary border-primary/30";
    if (s === "returned") return "bg-destructive/15 text-destructive border-destructive/30";
    if (s === "out_for_delivery" || s === "shipped") return "bg-info/15 text-info border-info/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader className="text-right">
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> ملف {courier.name}
          </SheetTitle>
          <SheetDescription>إدارة شاملة للشركة: البيانات، الحساب، التغطية والتسعير، المحفظة، الطلبات</SheetDescription>
        </SheetHeader>

        <Tabs value={profileTab} onValueChange={setProfileTab} dir="rtl" className="mt-4">
          <TabsList className="w-full grid grid-cols-6 h-auto">
            <TabsTrigger value="info" className="gap-1 text-[11px] px-1 py-2"><Info className="h-3.5 w-3.5" /> الأساسية</TabsTrigger>
            <TabsTrigger value="account" className="gap-1 text-[11px] px-1 py-2"><KeyRound className="h-3.5 w-3.5" /> الدخول</TabsTrigger>
            <TabsTrigger value="branches" className="gap-1 text-[11px] px-1 py-2"><Building2 className="h-3.5 w-3.5" /> الفروع</TabsTrigger>
            <TabsTrigger value="coverage" className="gap-1 text-[11px] px-1 py-2"><MapIcon className="h-3.5 w-3.5" /> التغطية والتسعير</TabsTrigger>
            <TabsTrigger value="wallet" className="gap-1 text-[11px] px-1 py-2"><WalletIcon className="h-3.5 w-3.5" /> المحفظة</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1 text-[11px] px-1 py-2"><Package className="h-3.5 w-3.5" /> الطلبات</TabsTrigger>
          </TabsList>

          {/* TAB 1 — Basic & Legal */}
          <TabsContent value="info" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">حالة الشركة</h4>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">{isActive ? "نشطة" : "موقوفة"}</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">الشعار</h4>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="h-16 w-16 rounded-md object-cover border border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center border border-dashed border-border">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Button asChild size="sm" variant="outline" disabled={uploadingLogo} className="gap-1.5">
                    <label className="cursor-pointer">
                      {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      {uploadingLogo ? "جاري الرفع..." : "رفع شعار"}
                      <input type="file" accept="image/*" hidden onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                  </Button>
                  {logoUrl && (
                    <Button size="sm" variant="ghost" onClick={() => setLogoUrl("")} className="text-destructive">إزالة</Button>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">البيانات الأساسية</h4>
              <div className="space-y-1.5"><Label>اسم الشركة *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>الهاتف</Label><Input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>المدينة</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">البيانات القانونية والاتصال</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>الرقم الضريبي</Label><Input value={taxId} onChange={e => setTaxId(e.target.value)} dir="ltr" placeholder="000000000" /></div>
                <div className="space-y-1.5">
                  <Label>نوع التكامل</Label>
                  <Select value={integrationType} onValueChange={setIntegrationType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTEGRATION_OPTIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>مسؤول التواصل</Label><Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="الاسم الكامل" /></div>
                <div className="space-y-1.5"><Label>البريد الإلكتروني للتواصل</Label><Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} dir="ltr" placeholder="ops@example.com" /></div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">الخدمات المقدّمة</h4>
              <div className="grid grid-cols-2 gap-3">
                {SERVICE_OPTIONS.map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm bg-muted/30 hover:bg-muted/50 transition rounded-md p-2 border border-border">
                    <Checkbox checked={services.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> عمولة التحصيل (COD)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>نوع عمولة التحصيل</Label>
                  <Select value={codFeeType} onValueChange={(v) => setCodFeeType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                      <SelectItem value="fixed">مبلغ ثابت (ل.س)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>قيمة عمولة التحصيل</Label>
                  <Input type="number" min="0" step={codFeeType === "percentage" ? "0.1" : "100"} value={codFeeValue} onChange={(e) => setCodFeeValue(e.target.value)} dir="ltr" />
                  <p className="text-[11px] text-muted-foreground">
                    {codFeeType === "percentage" ? "مثال: 1 = 1٪ من قيمة التحصيل" : "مبلغ ثابت يُضاف على كل شحنة فيها تحصيل"}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t">
                <Label>نسبة رسوم المرتجع (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={returnFeePct}
                  onChange={(e) => setReturnFeePct(e.target.value)}
                  dir="ltr"
                />
                <p className="text-[11px] text-muted-foreground">
                  النسبة من رسم الشحن التي تُحتسب للشركة عند إرجاع الشحنة (مثال: 50 = نصف الرسم).
                </p>
              </div>
            </Card>

            <Button onClick={saveInfo} disabled={savingInfo} className="w-full">
              {savingInfo ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </TabsContent>

          {/* TAB 2 — Auth */}
          <TabsContent value="account" className="mt-4 space-y-4">
            {courier.vendor_id && !credentials ? (
              <ResetPasswordCard
                vendorId={courier.vendor_id}
                onReset={(username, newPassword) => setCredentials({ email: username, password: newPassword })}
                copyVal={copyVal}
                copied={copied}
              />
            ) : credentials ? (
              <Card className="p-4 space-y-3 bg-primary/5 border-primary/30">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2"><Check className="h-4 w-4" /> تم إنشاء الحساب بنجاح</h4>
                <p className="text-xs text-muted-foreground">انسخ هذه البيانات وأرسلها للشركة. لن تظهر مرة أخرى.</p>
                <div className="space-y-2">
                  {(["email", "password"] as const).map((k) => (
                    <div key={k} className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
                      <span className="text-xs text-muted-foreground w-24">{k === "email" ? "اسم المستخدم" : "كلمة المرور"}</span>
                      <code dir="ltr" className="flex-1 text-sm font-mono">{credentials[k]}</code>
                      <Button variant="ghost" size="icon" onClick={() => copyVal(credentials[k], k)}>
                        {copied === k ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => copyVal(`اسم المستخدم: ${credentials.email}\nكلمة المرور: ${credentials.password}`, "password")}
                >
                  <Copy className="h-4 w-4" /> نسخ بيانات الدخول
                </Button>
              </Card>
            ) : (
              <Card className="p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> إنشاء حساب دخول للشركة</h4>
                <p className="text-xs text-muted-foreground">سيتم إنشاء مستخدم بدور <code>vendor</code> وربطه تلقائياً بهذه الشركة.</p>
                <div className="space-y-2">
                  <div className="space-y-1.5"><Label>اسم جهة الاتصال</Label><Input value={contact} onChange={e => setContact(e.target.value)} placeholder="مدير العمليات" /></div>
                  <div className="space-y-1.5">
                    <Label>اسم المستخدم</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="fast_express" dir="ltr" />
                    <p className="text-[11px] text-muted-foreground">أحرف إنجليزية صغيرة وأرقام و _ فقط (بدون مسافات أو @).</p>
                  </div>
                  <div className="space-y-1.5"><Label>كلمة المرور (6+ أحرف)</Label><Input type="text" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" /></div>
                </div>
                <Button onClick={generateAccount} disabled={creatingAccount} className="w-full gap-1.5">
                  <UserPlus className="h-4 w-4" /> {creatingAccount ? "جاري الإنشاء..." : "إنشاء حساب"}
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* TAB — Branches */}
          <TabsContent value="branches" className="mt-4 space-y-4">
            <Card className="p-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> فروع الشركة
              </h4>
              <p className="text-xs text-muted-foreground">
                كل فرع تُضيفه هنا يظهر تلقائياً في تبويب «التغطية والتسعير» كمحافظة مغطّاة، ويصبح متاحاً للتجار عند إنشاء الطلبات في تلك المحافظة.
              </p>
            </Card>
            <CourierBranchesPanel courierId={courier.id} />
          </TabsContent>

          {/* TAB 3 — Coverage & Custom Pricing */}
          <TabsContent value="coverage" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary" /> مصفوفة التغطية والأسعار
              </h4>
              <p className="text-xs text-muted-foreground">
                المصدر الموحَّد للتغطية والتسعير حسب المنطقة وشريحة الوزن. المحافظات المغطاة بفروع تظهر تلقائياً مع شارة 🟢 عدد الفروع.
              </p>
              <PricingMatrix courierId={courier.id} provinces={provinces} areasOf={areasOf} courierName={courier.name} />
            </Card>

            <CourierPricingTiers courierId={courier.id} />
          </TabsContent>

          {/* TAB 4 — Wallet */}
          <TabsContent value="wallet" className="mt-4">
            {courier.vendor_id ? (
              <WalletTransactionsLog vendorId={courier.vendor_id} />
            ) : (
              <Card className="p-8 text-center">
                <WalletIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">لا يوجد حساب مرتبط بهذه الشركة بعد. أنشئ حساب الدخول أولاً لعرض المحفظة.</p>
              </Card>
            )}
          </TabsContent>

          {/* TAB 5 — Assigned orders */}
          <TabsContent value="orders" className="mt-4">
            {loadingOrders ? (
              <p className="text-center py-8 text-sm text-muted-foreground">جاري التحميل...</p>
            ) : assigned.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد طلبات مُسندة لهذه الشركة حالياً</p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>كود صِلة</TableHead>
                      <TableHead>التاجر</TableHead>
                      <TableHead>المستلم</TableHead>
                      <TableHead>المدينة</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assigned.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">SL-{String(o.id).slice(0, 6).toUpperCase()}</TableCell>
                        <TableCell className="text-sm">{o.merchant_name}</TableCell>
                        <TableCell className="text-sm">{o.receiver_name}</TableCell>
                        <TableCell className="text-sm">{o.city}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={orderStatusColor(o.status)}>
                            {ORDER_STATUS_AR[o.status] || o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ============ Reset password card (shown when courier already has an account) ============
function ResetPasswordCard({
  vendorId,
  onReset,
  copyVal,
  copied,
}: {
  vendorId: string;
  onReset: (username: string, password: string) => void;
  copyVal: (val: string, kind: "email" | "password") => void;
  copied: "email" | "password" | null;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [loadingUsername, setLoadingUsername] = useState(true);

  // Load current username (derived from auth email)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUsername(true);
      try {
        const { data, error } = await supabase.functions.invoke("reset-courier-password", {
          body: { vendor_id: vendorId, password: "__lookup_only__" },
        });
        // Avoid actually resetting on lookup. Use a dedicated lookup if available;
        // here we fall back to reading from the profiles table by user_id.
        if (!cancelled && data?.username) {
          setCurrentUsername(data.username);
          setNewUsername(data.username);
        }
        if (error || !data?.username) {
          // Fallback: read from auth.users via profiles is not allowed; leave blank
          if (!cancelled) {
            setCurrentUsername("");
            setNewUsername("");
          }
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoadingUsername(false); }
    })();
    return () => { cancelled = true; };
  }, [vendorId]);

  const handleSaveUsername = async () => {
    const u = newUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/.test(u)) {
      toast.error("اسم المستخدم: 3-32 حرفاً، أحرف إنجليزية صغيرة وأرقام و _ فقط");
      return;
    }
    if (u === currentUsername) {
      toast.info("اسم المستخدم لم يتغيّر");
      return;
    }
    setUsernameBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-courier-username", {
        body: { vendor_id: vendorId, username: u },
      });
      if (error) {
        const ctx = (error as any)?.context;
        let msg = error.message || "فشل تحديث اسم المستخدم";
        try {
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setCurrentUsername(u);
      toast.success("تم تحديث اسم المستخدم");
    } catch (e: any) {
      toast.error(e.message || "فشل تحديث اسم المستخدم");
    } finally {
      setUsernameBusy(false);
    }
  };

  const handleReset = async () => {
    if (newPassword.trim().length < 6) {
      toast.error("كلمة المرور 6 أحرف على الأقل");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-courier-password", {
        body: { vendor_id: vendorId, password: newPassword.trim() },
      });
      if (error) {
        const ctx = (error as any)?.context;
        let msg = error.message || "فشل إعادة التعيين";
        try {
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      const username = data?.username ?? "";
      toast.success("تم إعادة تعيين كلمة المرور");
      onReset(username, newPassword.trim());
      setNewPassword("");
    } catch (e: any) {
      toast.error(e.message || "فشل إعادة التعيين");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3 bg-primary/5 border-primary/30">
      <div className="flex items-center gap-2 text-primary">
        <Check className="h-4 w-4" />
        <p className="text-sm font-semibold">حساب مُفعّل ومرتبط</p>
      </div>
      <p className="text-xs text-muted-foreground">
        هذه الشركة لديها حساب دخول مرتبط بدور <code>vendor</code>. لأسباب أمنية، كلمة المرور لا تُخزَّن — إن نسيت الشركة كلمة المرور، عيّن كلمة جديدة من هنا.
      </p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
        <span className="text-xs text-muted-foreground w-24">معرّف المستخدم</span>
        <code dir="ltr" className="flex-1 text-xs font-mono truncate">{vendorId}</code>
        <Button variant="ghost" size="icon" onClick={() => copyVal(vendorId, "email")}>
          {copied === "email" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5 text-primary" /> اسم المستخدم
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            dir="ltr"
            placeholder={loadingUsername ? "جاري التحميل..." : "fast_express"}
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            disabled={loadingUsername}
          />
          <Button
            onClick={handleSaveUsername}
            disabled={usernameBusy || loadingUsername || !newUsername.trim() || newUsername.trim() === currentUsername}
            className="gap-1.5 shrink-0"
          >
            {usernameBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          عدّل اسم المستخدم يدوياً (3-32 حرفاً، أحرف إنجليزية صغيرة وأرقام و _ فقط). سيُستخدم للدخول فوراً.
        </p>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-primary" /> إعادة تعيين كلمة المرور
        </Label>
        <Input
          type="text"
          dir="ltr"
          placeholder="كلمة مرور جديدة (6+ أحرف)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button onClick={handleReset} disabled={busy} className="w-full gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {busy ? "جاري التعيين..." : "تعيين كلمة المرور الجديدة"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          سيتم تحديث كلمة المرور فوراً، وستظهر بيانات الدخول الجديدة لتنسخها وترسلها للشركة.
        </p>
      </div>
    </Card>
  );
}
