import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SyrianPhoneInput } from "@/shared/components/inputs/SyrianPhoneInput";
import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface DistrictRow {
  id: string;
  name: string;
  parent_id: string | null;
  delivery_fee: number;
}
interface CourierOption { id: string; name: string }
interface CourierRate { courier_id: string; district_id: string; custom_delivery_fee: number }

export interface EditableOrder {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  district_id: string | null;
  courier_id: string | null;
  total_amount: number;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";

export default function EditOrderDialog({
  order,
  districts,
  couriers,
  courierRates,
  onClose,
  onSaved,
}: {
  order: EditableOrder;
  districts: DistrictRow[];
  couriers: CourierOption[];
  courierRates: CourierRate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const provinces = districts.filter(d => !d.parent_id);
  const areasOf = (provId: string) => districts.filter(d => d.parent_id === provId);

  // Resolve initial province/district
  const initialDistrict = districts.find(d => d.id === order.district_id);
  const initialProvinceId = initialDistrict
    ? (initialDistrict.parent_id || initialDistrict.id)
    : "";
  const initialDistrictId = initialDistrict?.parent_id ? initialDistrict.id : "";

  const [form, setForm] = useState({
    name: order.receiver_name,
    phone: order.phone_number,
    address: order.detailed_address || "",
    provinceId: initialProvinceId,
    districtId: initialDistrictId,
    cod: String(order.total_amount || 0),
    courierId: order.courier_id || "",
  });
  const [saving, setSaving] = useState(false);

  // Reset district if province changes and district doesn't belong
  useEffect(() => {
    if (form.districtId) {
      const d = districts.find(x => x.id === form.districtId);
      if (!d || d.parent_id !== form.provinceId) {
        setForm(f => ({ ...f, districtId: "" }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.provinceId]);

  const resolveDeliveryFee = (districtId: string | null, provinceId: string | null, courierId: string | null): number => {
    const dDefault = districts.find(d => d.id === districtId)?.delivery_fee ?? 0;
    const pDefault = districts.find(d => d.id === provinceId)?.delivery_fee ?? 0;
    if (!courierId) return dDefault || pDefault;
    if (districtId) {
      const r = courierRates.find(x => x.courier_id === courierId && x.district_id === districtId);
      if (r) return Number(r.custom_delivery_fee);
    }
    if (provinceId) {
      const r = courierRates.find(x => x.courier_id === courierId && x.district_id === provinceId);
      if (r) return Number(r.custom_delivery_fee);
    }
    return dDefault || pDefault;
  };

  const previewFee = form.provinceId
    ? resolveDeliveryFee(form.districtId || null, form.provinceId, form.courierId || null)
    : 0;

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.provinceId) {
      toast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    if (!isValidSyrianPhone(form.phone)) {
      toast.error("رقم سوري غير صحيح. مثال: 0933123456");
      return;
    }
    const prov = provinces.find(p => p.id === form.provinceId);
    const area = districts.find(d => d.id === form.districtId);
    const finalDistrictId = area?.id || prov?.id || null;
    const cityLabel = prov?.name || order.city;
    const cod = Number(form.cod) || 0;
    const deliveryFee = resolveDeliveryFee(area?.id || null, prov?.id || null, form.courierId || null);

    setSaving(true);
    const { error } = await supabase.from("orders").update({
      receiver_name: form.name,
      phone_number: form.phone,
      city: cityLabel,
      detailed_address: form.address,
      district_id: finalDistrictId,
      courier_id: form.courierId || null,
      total_amount: cod,
      delivery_fee: deliveryFee,
    } as any).eq("id", order.id);
    setSaving(false);
    if (error) { toast.error(error.message || "تعذر حفظ التعديلات"); return; }
    toast.success("تم تحديث الطلب");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل الطلب</DialogTitle>
          <DialogDescription>عدّل بيانات الطلب وشركة الشحن. يُحسب delivery_fee تلقائياً.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>اسم الزبون *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهاتف *</Label>
            <SyrianPhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>العنوان التفصيلي</Label>
            <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>المحافظة *</Label>
            <Select value={form.provinceId} onValueChange={v => setForm({ ...form, provinceId: v, districtId: "" })}>
              <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
              <SelectContent>
                {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>المنطقة / الحي</Label>
            <Select
              value={form.districtId}
              onValueChange={v => setForm({ ...form, districtId: v })}
              disabled={!form.provinceId || areasOf(form.provinceId).length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={!form.provinceId ? "اختر محافظة أولاً" : areasOf(form.provinceId).length === 0 ? "لا توجد مناطق" : "اختر المنطقة"} />
              </SelectTrigger>
              <SelectContent>
                {areasOf(form.provinceId).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>المبلغ المطلوب تحصيله (ل.س)</Label>
            <Input type="number" value={form.cod} onChange={e => setForm({ ...form, cod: e.target.value })} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>شركة الشحن</Label>
            <Select value={form.courierId} onValueChange={v => setForm({ ...form, courierId: v })}>
              <SelectTrigger>
                <SelectValue placeholder={couriers.length === 0 ? "لا توجد شركات" : "اختر شركة شحن"} />
              </SelectTrigger>
              <SelectContent>
                {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.provinceId && (
            <div className="md:col-span-2 text-sm rounded-md border border-border bg-muted/30 px-3 py-2">
              رسوم الشحن المحسوبة: <span className="font-semibold text-primary">{fmtSYP(previewFee)}</span>
              {form.courierId && <span className="text-xs text-muted-foreground mr-2">(يُطبَّق سعر الشركة المخصص إن وُجد)</span>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
