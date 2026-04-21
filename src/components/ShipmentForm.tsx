import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Loader2, MapPin, AlertCircle, ShieldAlert, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { calculatePricing, isLossOrder } from "@/lib/pricing-engine";

interface District {
  id: string;
  name: string;
  parent_id: string | null;
  province: string;
  province_ar: string;
  delivery_fee: number;
}

interface CourierOption {
  rate_id: string;
  courier_id: string;
  name: string;
  services: string[];
  fee: number;
}

const SERVICE_LABELS: Record<string, string> = {
  same_day: "نفس اليوم",
  heavy: "ثقيل",
  fragile: "قابل للكسر",
  refrigerated: "مبرد",
};

interface ShipmentFormProps {
  onCreated: () => void;
  prefill?: {
    receiver_name?: string;
    phone_number?: string;
    city?: string;
    detailed_address?: string;
    cod_amount?: string;
    order_id?: string;
  };
}

// Testing mode: accept international numbers (+90xxx, +963xxx, 09xxx, etc.)
const INTL_PHONE_REGEX = /^\+?\d{7,15}$/;
function validatePhone(phone: string): boolean {
  return INTL_PHONE_REGEX.test(phone.replace(/[\s-]/g, ""));
}

const CITY_MAP: Record<string, "Damascus" | "Aleppo" | "Homs" | "Lattakia" | "Hama" | "Tartous"> = {
  Damascus: "Damascus", "Rural Damascus": "Damascus", Aleppo: "Aleppo",
  Homs: "Homs", Hama: "Hama", Lattakia: "Lattakia", Tartous: "Tartous",
};

export default function ShipmentForm({ onCreated, prefill }: ShipmentFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("");

  // Smart Routing: couriers covering the selected district
  const [courierOptions, setCourierOptions] = useState<CourierOption[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [selectedCourierRateId, setSelectedCourierRateId] = useState("");

  const [phoneError, setPhoneError] = useState("");
  const [form, setForm] = useState({
    receiver_name: prefill?.receiver_name || "",
    phone_number: prefill?.phone_number || "",
    detailed_address: prefill?.detailed_address || "",
    cod_amount: prefill?.cod_amount || "",
    notes: "",
  });

  useEffect(() => {
    supabase.from("districts").select("id,name,parent_id,province,province_ar,delivery_fee").eq("is_active", true)
      .then(({ data }) => { if (data) setDistricts(data as any); });
  }, []);

  useEffect(() => {
    if (prefill) {
      setForm({
        receiver_name: prefill.receiver_name || "", phone_number: prefill.phone_number || "",
        detailed_address: prefill.detailed_address || "", cod_amount: prefill.cod_amount || "",
        notes: "",
      });
      if (prefill.city && districts.length > 0) {
        const match = districts.find(d => !d.parent_id && (d.province_ar === prefill.city || d.province === prefill.city || d.name === prefill.city));
        if (match) setSelectedProvinceId(match.id);
      }
    }
  }, [prefill, districts]);

  const provinces = useMemo(
    () => districts.filter(d => !d.parent_id).sort((a, b) => a.province_ar.localeCompare(b.province_ar, "ar")),
    [districts]
  );

  const areas = useMemo(
    () => selectedProvinceId
      ? districts.filter(d => d.parent_id === selectedProvinceId).sort((a, b) => a.name.localeCompare(b.name, "ar"))
      : [],
    [districts, selectedProvinceId]
  );

  useEffect(() => { setSelectedAreaId(""); }, [selectedProvinceId]);

  const selectedProvince = useMemo(() => provinces.find(p => p.id === selectedProvinceId) || null, [provinces, selectedProvinceId]);
  const selectedArea = useMemo(() => areas.find(a => a.id === selectedAreaId) || null, [areas, selectedAreaId]);

  // Resolve final district id (area takes precedence, fallback to province row)
  const finalDistrictId = selectedArea?.id || selectedProvince?.id || "";

  // Fetch couriers covering this district from courier_district_rates ONLY (no defaults / no fallbacks)
  useEffect(() => {
    setSelectedCourierRateId("");
    setCourierOptions([]);
    if (!finalDistrictId) return;
    let cancelled = false;
    (async () => {
      setLoadingCouriers(true);
      const { data, error } = await supabase
        .from("courier_district_rates" as any)
        .select("id, courier_id, custom_delivery_fee, couriers!inner(id, name, services, is_active)")
        .eq("district_id", finalDistrictId);
      if (cancelled) return;
      if (error) {
        toast.error("تعذر جلب شركات الشحن");
        setLoadingCouriers(false);
        return;
      }
      const opts: CourierOption[] = (data || [])
        .filter((r: any) => r.couriers?.is_active)
        .map((r: any) => ({
          rate_id: r.id,
          courier_id: r.courier_id,
          name: r.couriers.name,
          services: r.couriers.services || [],
          fee: Number(r.custom_delivery_fee) || 0,
        }))
        .sort((a, b) => a.fee - b.fee);
      setCourierOptions(opts);
      setLoadingCouriers(false);
    })();
    return () => { cancelled = true; };
  }, [finalDistrictId]);

  const selectedCourier = useMemo(
    () => courierOptions.find(c => c.rate_id === selectedCourierRateId) || null,
    [courierOptions, selectedCourierRateId]
  );

  // Carrier fee comes EXCLUSIVELY from the selected courier's rate. No defaults.
  const carrierFee = selectedCourier ? selectedCourier.fee : 0;
  const codAmount = parseFloat(form.cod_amount) || 0;

  // Use pricing engine — merchant sees merchant_shipping_fee + collection_fee
  const pricing = useMemo(() => {
    return calculatePricing({ carrier_fee: carrierFee, cod_amount: codAmount });
  }, [carrierFee, codAmount]);

  const lossOrder = codAmount > 0 && isLossOrder(pricing, codAmount);

  const handlePhoneChange = (val: string) => {
    setForm({ ...form, phone_number: val });
    setPhoneError(val && !validatePhone(val) ? "صيغة الرقم غير صحيحة. مثال: +905xxxxxxxxx أو 0912345678" : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvinceId || !selectedProvince) { toast.error("الرجاء اختيار المحافظة"); return; }
    if (!selectedCourier) { toast.error("الرجاء اختيار شركة الشحن"); return; }
    if (!validatePhone(form.phone_number)) { toast.error("رقم الهاتف غير صحيح"); return; }
    if (lossOrder) { toast.error("لا يمكن إتمام الطلب: تكلفة الشحن والتحصيل أكبر من قيمة الطلب"); return; }

    setLoading(true);
    const tracking = `SIL-${Date.now().toString(36).toUpperCase()}`;
    const provinceAr = selectedProvince.province_ar;
    const cityEnum = CITY_MAP[selectedProvince.province] || "Damascus";

    // Order uses merchant-visible fees
    const { data: order, error: orderErr } = await supabase.from("orders").insert({
      merchant_id: user?.id || "",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: provinceAr,
      detailed_address: form.detailed_address.trim(),
      district_id: finalDistrictId,
      courier_id: selectedCourier.courier_id,
      total_amount: codAmount,
      delivery_fee: pricing.merchant_shipping_fee,
      platform_fee: pricing.collection_fee,
      net_amount: pricing.net_to_merchant,
      notes: form.notes.trim() || null,
      status: "new",
    } as any).select().single();

    if (orderErr) { toast.error(orderErr.message); setLoading(false); return; }

    // Shipment stores internal pricing breakdown
    const { error: shipErr } = await supabase.from("shipments").insert({
      merchant_id: user?.id || "",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: cityEnum,
      detailed_address: form.detailed_address.trim(),
      cod_amount: codAmount,
      tracking_number: tracking,
      shipping_fee: pricing.merchant_shipping_fee,
      carrier_fee: pricing.carrier_fee,
      platform_margin: pricing.platform_margin,
      collection_fee: pricing.collection_fee,
      merchant_shipping_fee: pricing.merchant_shipping_fee,
      billable_weight: pricing.billable_weight,
      volumetric_weight: pricing.volumetric_weight,
      order_id: (order as any)?.id || prefill?.order_id || null,
      carrier_id: null,
      courier_id: selectedCourier.courier_id,
      notes: form.notes.trim() || null,
      status: "pending",
    } as any);

    if (shipErr) { toast.error(shipErr.message); setLoading(false); return; }

    setLoading(false);
    toast.success(`تم إنشاء الطلب والشحنة — رقم التتبع: ${tracking}`);
    setForm({ receiver_name: "", phone_number: "", detailed_address: "", cod_amount: "", notes: "" });
    setSelectedProvinceId(""); setSelectedAreaId(""); setSelectedCourierRateId("");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-6">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">طلب شحنة جديدة</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم المستلم <span className="text-destructive">*</span></Label>
          <Input placeholder="الاسم الكامل" value={form.receiver_name} onChange={e => setForm({ ...form, receiver_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>رقم الهاتف <span className="text-destructive">*</span></Label>
          <Input placeholder="0912345678" value={form.phone_number} onChange={e => handlePhoneChange(e.target.value)} required dir="ltr" className={phoneError ? "border-destructive" : ""} />
          {phoneError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {phoneError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span></Label>
          <Select value={selectedProvinceId} onValueChange={setSelectedProvinceId}>
            <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
            <SelectContent>{provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.province_ar}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {areas.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المنطقة</Label>
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
              <SelectTrigger><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
              <SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {selectedProvinceId && areas.length === 0 && (
          <div className="md:col-span-2 flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>لا توجد مناطق فرعية لهذه المحافظة. سيتم احتساب رسوم المحافظة الأساسية.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>العنوان التفصيلي <span className="text-destructive">*</span></Label>
          <Textarea placeholder="الشارع، البناء، الطابق..." value={form.detailed_address} onChange={e => setForm({ ...form, detailed_address: e.target.value })} required rows={3} />
        </div>
        <div className="space-y-2">
          <Label>مبلغ التحصيل عند الاستلام (ل.س)</Label>
          <Input type="number" min="0" step="1" placeholder="0" value={form.cod_amount} onChange={e => setForm({ ...form, cod_amount: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>ملاحظات لشركة الشحن</Label>
        <Textarea placeholder="مثال: الزبون يفضل الاستلام بعد الساعة 4 مساءً..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>

      {/* Pricing display — merchant sees shipping_fee + collection_fee, NOT carrier_fee or margin */}
      {selectedProvince && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">رسوم الشحن</p>
              <p className="text-lg font-display font-bold text-foreground">
                {pricing.merchant_shipping_fee > 0 ? `${pricing.merchant_shipping_fee.toLocaleString()} ل.س` : "غير محدد لهذه المنطقة"}
              </p>
            </div>
            {codAmount > 0 && (
              <>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">بدل تحصيل (1%)</p>
                  <p className="text-lg font-display font-bold text-foreground">{pricing.collection_fee.toLocaleString()} ل.س</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">صافي الربح</p>
                  <p className={`text-lg font-display font-bold ${pricing.net_to_merchant >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {pricing.net_to_merchant.toLocaleString()} ل.س
                  </p>
                </div>
              </>
            )}
          </div>

          {lossOrder && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <p>⚠️ لا يمكن إتمام هذا الطلب: تكلفة الشحن والتحصيل ({pricing.total_merchant_cost.toLocaleString()} ل.س) أكبر من قيمة التحصيل ({codAmount.toLocaleString()} ل.س)</p>
            </div>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading || lossOrder} className="w-full">
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Package className="ml-2 h-4 w-4" />}
        إنشاء طلب شحن
      </Button>
    </form>
  );
}
