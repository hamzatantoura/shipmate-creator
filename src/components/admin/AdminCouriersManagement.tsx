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
import { Plus, Truck, Trash2, DollarSign, Settings2, UserPlus, Copy, Check, Map, Package, Info, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  is_active: boolean;
  vendor_id: string | null;
  services?: string[] | null;
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

interface CourierRate {
  id: string;
  courier_id: string;
  district_id: string;
  custom_delivery_fee: number;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";

export default function AdminCouriersManagement() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [rates, setRates] = useState<CourierRate[]>([]);
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
    const [cRes, dRes, rRes, vRes] = await Promise.all([
      supabase.from("couriers").select("id, name, phone, city, is_active, vendor_id, services" as any).order("name"),
      supabase.from("districts").select("id, name, parent_id, province_ar, delivery_fee").order("name"),
      supabase.from("courier_district_rates" as any).select("id, courier_id, district_id, custom_delivery_fee"),
      supabase.from("profiles").select("user_id, contact_person, phone, store_name").eq("role", "vendor"),
    ]);
    if (cRes.data) setCouriers(cRes.data as unknown as Courier[]);
    if (dRes.data) setDistricts(dRes.data as DistrictRow[]);
    if (rRes.data) setRates(rRes.data as unknown as CourierRate[]);
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
    if (!confirm(`حذف شركة الشحن "${c.name}"؟ سيتم حذف جميع تسعيراتها.`)) return;
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
          <p className="text-sm text-muted-foreground">إدارة الشركات وتسعيراتها المخصصة لكل منطقة</p>
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
                  <TableHead>تسعيرات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couriers.map(c => {
                  const count = rates.filter(r => r.courier_id === c.id).length;
                  const linked = vendorById(c.vendor_id);
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={(e) => {
                      // ignore clicks on interactive cells
                      const tag = (e.target as HTMLElement).closest('button, [role="combobox"], input, select, [data-no-row-click]');
                      if (tag) return;
                      setProfileCourier(c);
                    }}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
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
                        <Badge variant="outline" className="gap-1">
                          <DollarSign className="h-3 w-3" /> {count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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
          rates={rates.filter(r => r.courier_id === profileCourier.id)}
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

function RatesEditor({ courier, districts, provinces, areasOf, rates, onChanged }: {
  courier: Courier;
  districts: DistrictRow[];
  provinces: DistrictRow[];
  areasOf: (id: string) => DistrictRow[];
  rates: CourierRate[];
  onChanged: () => void;
}) {
  const [selectedProv, setSelectedProv] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);

  const districtName = (id: string) => {
    const d = districts.find(x => x.id === id);
    if (!d) return id;
    if (d.parent_id) {
      const p = districts.find(x => x.id === d.parent_id);
      return `${p?.name || ""} — ${d.name}`;
    }
    return d.name;
  };
  const defaultFee = (id: string) => districts.find(x => x.id === id)?.delivery_fee ?? 0;

  const addRate = async () => {
    const districtId = selectedDistrict || selectedProv;
    if (!districtId) { toast.error("اختر منطقة"); return; }
    const fNum = Number(fee);
    if (!fee || isNaN(fNum) || fNum < 0) { toast.error("أدخل سعراً صحيحاً"); return; }
    setSaving(true);
    const { error } = await supabase.from("courier_district_rates" as any).upsert({
      courier_id: courier.id,
      district_id: districtId,
      custom_delivery_fee: fNum,
    } as any, { onConflict: "courier_id,district_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ السعر المخصص");
    setSelectedProv(""); setSelectedDistrict(""); setFee("");
    onChanged();
  };

  const deleteRate = async (id: string) => {
    const { error } = await supabase.from("courier_district_rates" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف السعر");
    onChanged();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">عيّن سعراً مخصصاً لمناطق محددة. المناطق غير المُعرّفة تستخدم السعر الافتراضي.</p>
      <Card className="p-3 bg-muted/30">
          <h4 className="text-sm font-semibold mb-3">إضافة / تحديث سعر</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={selectedProv} onValueChange={(v) => { setSelectedProv(v); setSelectedDistrict(""); }}>
              <SelectTrigger><SelectValue placeholder="المحافظة" /></SelectTrigger>
              <SelectContent>
                {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict} disabled={!selectedProv || areasOf(selectedProv).length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedProv ? "اختر محافظة" : areasOf(selectedProv).length === 0 ? "لا توجد مناطق فرعية" : "المنطقة (اختياري)"} />
              </SelectTrigger>
              <SelectContent>
                {areasOf(selectedProv).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="السعر المخصص (ل.س)"
              value={fee}
              onChange={e => setFee(e.target.value)}
              dir="ltr"
            />
          </div>
          <Button onClick={addRate} disabled={saving} className="mt-3 gap-1" size="sm">
            <Plus className="h-3.5 w-3.5" /> {saving ? "جاري الحفظ..." : "حفظ السعر"}
          </Button>
        </Card>

        <div>
          <h4 className="text-sm font-semibold mb-2">الأسعار الحالية ({rates.length})</h4>
          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد تسعيرات مخصصة بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنطقة</TableHead>
                  <TableHead>السعر الافتراضي</TableHead>
                  <TableHead>السعر المخصص</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{districtName(r.district_id)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{fmtSYP(defaultFee(r.district_id))}</TableCell>
                    <TableCell className="font-semibold text-primary">{fmtSYP(r.custom_delivery_fee)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteRate(r.id)} className="text-destructive">
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

function CourierProfileSheet({ courier, districts, provinces, areasOf, rates, onClose, onRefresh }: {
  courier: Courier;
  districts: DistrictRow[];
  provinces: DistrictRow[];
  areasOf: (id: string) => DistrictRow[];
  rates: CourierRate[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  // Tab 1: Info & Services
  const [name, setName] = useState(courier.name);
  const [phone, setPhone] = useState(courier.phone || "");
  const [city, setCity] = useState(courier.city || "");
  const [services, setServices] = useState<string[]>(courier.services || []);
  const [savingInfo, setSavingInfo] = useState(false);

  // Tab 2: Onboarding
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  // Tab 4: Assigned orders
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

  const saveInfo = async () => {
    if (!name.trim()) { toast.error("اسم الشركة مطلوب"); return; }
    setSavingInfo(true);
    const { error } = await supabase.from("couriers").update({
      name: name.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      services,
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
    const fakeEmail = `${username}@courier.sila.local`;
    setCreatingAccount(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { role: "vendor", contact_person: contact.trim(), store_name: courier.name },
        },
      });
      if (error) throw error;
      const newUserId = data.user?.id;
      if (!newUserId) throw new Error("فشل إنشاء الحساب");
      const { error: linkErr } = await supabase.from("couriers")
        .update({ vendor_id: newUserId } as any).eq("id", courier.id);
      if (linkErr) throw linkErr;
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
          <SheetDescription>إدارة شاملة للشركة: البيانات، الحساب، التسعيرات والطلبات</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="info" dir="rtl" className="mt-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="info" className="gap-1 text-xs"><Info className="h-3.5 w-3.5" /> بيانات وخدمات</TabsTrigger>
            <TabsTrigger value="account" className="gap-1 text-xs"><KeyRound className="h-3.5 w-3.5" /> حساب الدخول</TabsTrigger>
            <TabsTrigger value="rates" className="gap-1 text-xs"><Map className="h-3.5 w-3.5" /> مناطق وتخفيضات</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1 text-xs"><Package className="h-3.5 w-3.5" /> الطلبات الحالية</TabsTrigger>
          </TabsList>

          {/* TAB 1 */}
          <TabsContent value="info" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">البيانات الأساسية</h4>
              <div className="space-y-1.5"><Label>اسم الشركة *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>الهاتف</Label><Input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>المدينة</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
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

            <Button onClick={saveInfo} disabled={savingInfo} className="w-full">
              {savingInfo ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </TabsContent>

          {/* TAB 2 */}
          <TabsContent value="account" className="mt-4 space-y-4">
            {courier.vendor_id && !credentials ? (
              <Card className="p-4 bg-primary/5 border-primary/30">
                <div className="flex items-center gap-2 text-primary">
                  <Check className="h-4 w-4" />
                  <p className="text-sm font-semibold">حساب الشركة مُفعّل ومرتبط</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">معرّف المستخدم: <span dir="ltr" className="font-mono">{courier.vendor_id}</span></p>
              </Card>
            ) : credentials ? (
              <Card className="p-4 space-y-3 bg-primary/5 border-primary/30">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2"><Check className="h-4 w-4" /> تم إنشاء الحساب بنجاح</h4>
                <p className="text-xs text-muted-foreground">انسخ هذه البيانات وأرسلها للشركة. لن تظهر مرة أخرى.</p>
                <div className="space-y-2">
                  {(["email", "password"] as const).map((k) => (
                    <div key={k} className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
                      <span className="text-xs text-muted-foreground w-24">{k === "email" ? "البريد" : "كلمة المرور"}</span>
                      <code dir="ltr" className="flex-1 text-sm font-mono">{credentials[k]}</code>
                      <Button variant="ghost" size="icon" onClick={() => copyVal(credentials[k], k)}>
                        {copied === k ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> إنشاء حساب دخول للشركة</h4>
                <p className="text-xs text-muted-foreground">سيتم إنشاء مستخدم بدور <code>vendor</code> وربطه تلقائياً بهذه الشركة.</p>
                <div className="space-y-2">
                  <div className="space-y-1.5"><Label>اسم جهة الاتصال</Label><Input value={contact} onChange={e => setContact(e.target.value)} placeholder="مدير العمليات" /></div>
                  <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ops@company.com" dir="ltr" /></div>
                  <div className="space-y-1.5"><Label>كلمة المرور (6+ أحرف)</Label><Input type="text" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" /></div>
                </div>
                <Button onClick={generateAccount} disabled={creatingAccount} className="w-full gap-1.5">
                  <UserPlus className="h-4 w-4" /> {creatingAccount ? "جاري الإنشاء..." : "إنشاء حساب"}
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* TAB 3 */}
          <TabsContent value="rates" className="mt-4">
            <RatesEditor
              courier={courier}
              districts={districts}
              provinces={provinces}
              areasOf={areasOf}
              rates={rates}
              onChanged={onRefresh}
            />
          </TabsContent>

          {/* TAB 4 */}
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
