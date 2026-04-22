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
import { Plus, Truck, Trash2, DollarSign, Settings2, UserPlus, Copy, Check, Map as MapIcon, Package, Info, KeyRound, Loader2, Wallet as WalletIcon, Image as ImageIcon, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import WalletTransactionsLog from "@/components/shared/WalletTransactionsLog";

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

interface WeightTier {
  id: string;
  courier_id: string;
  min_weight: number;
  max_weight: number;
  price: number;
}

interface CoverageArea {
  id: string;
  courier_id: string;
  province_id: string | null;
  district_id: string | null;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";

export default function AdminCouriersManagement() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileCourier, setProfileCourier] = useState<Courier | null>(null);

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

    const { error } = await supabase.from("couriers").insert({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      is_active: true,
      vendor_id: user.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت إضافة شركة الشحن");
    setForm({ name: "", phone: "", city: "" });
    setCreateOpen(false);
    fetchAll();
  };

  const toggleActive = async (c: Courier) => {
    const { error } = await supabase.from("couriers")
      .update({ is_active: !c.is_active } as any).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };

  const handleDelete = async (c: Courier) => {
    if (!confirm(`حذف شركة الشحن "${c.name}"؟ سيتم حذف جميع تسعيراتها وتغطياتها.`)) return;
    const { error } = await supabase.from("couriers").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    fetchAll();
  };

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
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" dir="ltr" />
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
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="text-destructive">
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

// ============ Coverage editor ============
function CoverageEditor({ courierId, provinces, areasOf }: {
  courierId: string;
  provinces: DistrictRow[];
  areasOf: (id: string) => DistrictRow[];
}) {
  const [areas, setAreas] = useState<CoverageArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("courier_coverage_areas" as any)
      .select("*").eq("courier_id", courierId);
    setAreas((data || []) as unknown as CoverageArea[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [courierId]);

  const provinceCovered = (provId: string) =>
    areas.some(a => a.province_id === provId);
  const districtCovered = (distId: string) =>
    areas.some(a => a.district_id === distId);

  const toggleProvince = async (provId: string) => {
    if (provinceCovered(provId)) {
      const row = areas.find(a => a.province_id === provId);
      if (!row) return;
      const { error } = await supabase.from("courier_coverage_areas" as any).delete().eq("id", row.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("courier_coverage_areas" as any).insert({
        courier_id: courierId, province_id: provId,
      } as any);
      if (error) { toast.error(error.message); return; }
    }
    load();
  };

  const toggleDistrict = async (distId: string) => {
    if (districtCovered(distId)) {
      const row = areas.find(a => a.district_id === distId);
      if (!row) return;
      const { error } = await supabase.from("courier_coverage_areas" as any).delete().eq("id", row.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("courier_coverage_areas" as any).insert({
        courier_id: courierId, district_id: distId,
      } as any);
      if (error) { toast.error(error.message); return; }
    }
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">حدّد المحافظات أو المناطق الفرعية التي تُغطّيها هذه الشركة. لا توجد أسعار هنا — التسعير يُدار في القسم أدناه.</p>
      <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-y-auto">
        {provinces.map(p => {
          const isExp = expanded[p.id];
          const subs = areasOf(p.id);
          return (
            <div key={p.id}>
              <div className="flex items-center gap-2 p-2 hover:bg-muted/40">
                <Checkbox
                  checked={provinceCovered(p.id)}
                  onCheckedChange={() => toggleProvince(p.id)}
                />
                <button
                  type="button"
                  className="flex-1 text-right text-sm font-medium flex items-center justify-between"
                  onClick={() => setExpanded(s => ({ ...s, [p.id]: !s[p.id] }))}
                >
                  <span>{p.name}</span>
                  {subs.length > 0 && (
                    isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
              {isExp && subs.length > 0 && (
                <div className="bg-muted/20 border-t border-border px-3 py-2 space-y-1">
                  {subs.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={districtCovered(s.id)}
                        onCheckedChange={() => toggleDistrict(s.id)}
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        المغطّى حالياً: {areas.length} منطقة/محافظة
      </p>
    </div>
  );
}

// ============ Weight tiers editor ============
function WeightTiersEditor({ courierId }: { courierId: string }) {
  const [tiers, setTiers] = useState<WeightTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [minW, setMinW] = useState("");
  const [maxW, setMaxW] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("courier_weight_tiers" as any)
      .select("*").eq("courier_id", courierId).order("min_weight");
    setTiers((data || []) as unknown as WeightTier[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [courierId]);

  const addTier = async () => {
    const mn = Number(minW), mx = Number(maxW), pr = Number(price);
    if ([mn, mx, pr].some(v => isNaN(v)) || mn < 0 || mx < mn || pr < 0) {
      toast.error("أدخل قيماً صحيحة (الحد الأقصى ≥ الأدنى)");
      return;
    }
    // Overlap check (client-side)
    const overlaps = tiers.some(t =>
      !(mx < t.min_weight || mn > t.max_weight)
    );
    if (overlaps) { toast.error("هذه الشريحة تتداخل مع شريحة موجودة"); return; }

    setSaving(true);
    const { error } = await supabase.from("courier_weight_tiers" as any).insert({
      courier_id: courierId, min_weight: mn, max_weight: mx, price: pr,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت إضافة الشريحة");
    setMinW(""); setMaxW(""); setPrice("");
    load();
  };

  const removeTier = async (id: string) => {
    const { error } = await supabase.from("courier_weight_tiers" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الشريحة");
    load();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        أسعار خاصة بهذه الشركة فقط. كل شريحة وزن لها سعرها الموحّد بغضّ النظر عن المنطقة.
      </p>

      <Card className="p-3 bg-muted/30">
        <h4 className="text-sm font-semibold mb-3">إضافة شريحة وزن جديدة</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">من وزن (كغ)</Label>
            <Input type="number" min="0" step="0.1" value={minW} onChange={e => setMinW(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">إلى وزن (كغ)</Label>
            <Input type="number" min="0" step="0.1" value={maxW} onChange={e => setMaxW(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">السعر (ل.س)</Label>
            <Input type="number" min="0" step="100" value={price} onChange={e => setPrice(e.target.value)} dir="ltr" />
          </div>
        </div>
        <Button onClick={addTier} disabled={saving} className="mt-3 gap-1" size="sm">
          <Plus className="h-3.5 w-3.5" /> {saving ? "جاري الحفظ..." : "إضافة الشريحة"}
        </Button>
      </Card>

      <div>
        <h4 className="text-sm font-semibold mb-2">شرائح الأوزان ({tiers.length})</h4>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
        ) : tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد شرائح مُعرّفة بعد</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>من (كغ)</TableHead>
                <TableHead>إلى (كغ)</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map(t => (
                <TableRow key={t.id}>
                  <TableCell dir="ltr" className="text-sm">{t.min_weight}</TableCell>
                  <TableCell dir="ltr" className="text-sm">{t.max_weight}</TableCell>
                  <TableCell className="font-semibold text-primary">{fmtSYP(Number(t.price))}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeTier(t.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
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
  const [taxId, setTaxId] = useState(courier.tax_id || "");
  const [contactPerson, setContactPerson] = useState(courier.contact_person || "");
  const [contactEmail, setContactEmail] = useState(courier.contact_email || "");
  const [integrationType, setIntegrationType] = useState(courier.integration_type || "portal");
  const [logoUrl, setLogoUrl] = useState(courier.logo_url || "");
  const [isActive, setIsActive] = useState(courier.is_active);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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

        <Tabs defaultValue="info" dir="rtl" className="mt-4">
          <TabsList className="w-full grid grid-cols-5 h-auto">
            <TabsTrigger value="info" className="gap-1 text-[11px] px-1 py-2"><Info className="h-3.5 w-3.5" /> الأساسية</TabsTrigger>
            <TabsTrigger value="account" className="gap-1 text-[11px] px-1 py-2"><KeyRound className="h-3.5 w-3.5" /> الدخول</TabsTrigger>
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

          {/* TAB 3 — Coverage & Custom Pricing */}
          <TabsContent value="coverage" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary" /> القسم أ — مناطق التغطية
              </h4>
              <CoverageEditor courierId={courier.id} provinces={provinces} areasOf={areasOf} />
            </Card>

            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> القسم ب — شرائح الأوزان والأسعار (خاصة بهذه الشركة)
              </h4>
              <WeightTiersEditor courierId={courier.id} />
            </Card>
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
