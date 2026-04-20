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
import { Plus, Truck, Trash2, DollarSign, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  is_active: boolean;
  vendor_id: string | null;
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
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [ratesCourier, setRatesCourier] = useState<Courier | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", city: "" });

  const provinces = useMemo(() => districts.filter(d => !d.parent_id), [districts]);
  const areasOf = (provId: string) => districts.filter(d => d.parent_id === provId);

  const fetchAll = async () => {
    setLoading(true);
    const [cRes, dRes, rRes] = await Promise.all([
      supabase.from("couriers").select("id, name, phone, city, is_active, vendor_id").order("name"),
      supabase.from("districts").select("id, name, parent_id, province_ar, delivery_fee").order("name"),
      supabase.from("courier_district_rates" as any).select("id, courier_id, district_id, custom_delivery_fee"),
    ]);
    if (cRes.data) setCouriers(cRes.data as Courier[]);
    if (dRes.data) setDistricts(dRes.data as DistrictRow[]);
    if (rRes.data) setRates(rRes.data as unknown as CourierRate[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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
                  <TableHead>تسعيرات مخصصة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couriers.map(c => {
                  const count = rates.filter(r => r.courier_id === c.id).length;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{c.phone || "—"}</TableCell>
                      <TableCell>{c.city || "—"}</TableCell>
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
                          <Button variant="ghost" size="sm" onClick={() => setRatesCourier(c)} className="gap-1">
                            <Settings2 className="h-3.5 w-3.5" /> الأسعار
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

      {ratesCourier && (
        <CourierRatesDialog
          courier={ratesCourier}
          districts={districts}
          provinces={provinces}
          areasOf={areasOf}
          rates={rates.filter(r => r.courier_id === ratesCourier.id)}
          onClose={() => { setRatesCourier(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

function CourierRatesDialog({
  courier, districts, provinces, areasOf, rates, onClose,
}: {
  courier: Courier;
  districts: DistrictRow[];
  provinces: DistrictRow[];
  areasOf: (id: string) => DistrictRow[];
  rates: CourierRate[];
  onClose: () => void;
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
    onClose();
  };

  const deleteRate = async (id: string) => {
    const { error } = await supabase.from("courier_district_rates" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف السعر");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسعيرات {courier.name}</DialogTitle>
          <DialogDescription>
            عيّن سعراً مخصصاً لمناطق محددة. المناطق غير المُعرّفة تستخدم السعر الافتراضي للمنصة.
          </DialogDescription>
        </DialogHeader>

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

        <div className="mt-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
