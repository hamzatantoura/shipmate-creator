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
import { Package, Loader2, MapPin, AlertCircle, ShieldAlert, Truck, Weight } from "lucide-react";
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
  courier_id: string;
  name: string;
  logo_url: string | null;
  services: string[];
  fee: number;
  tier_label: string; // e.g. "0–5 كغ"
  cod_fee_type: "fixed" | "percentage";
  cod_fee_value: number;
  cod_fee: number; // computed for current cod amount
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

  // Merchant origin (must exist before form is usable)
  const [merchantProvinceId, setMerchantProvinceId] = useState<string | null>(null);
  const [merchantLoaded, setMerchantLoaded] = useState(false);

  // Mandatory weight in KG
  const [weight, setWeight] = useState<string>("1");

  // Smart Routing: couriers covering the selected district
  const [courierOptions, setCourierOptions] = useState<CourierOption[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState("");

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

  // Load merchant origin province
  useEffect(() => {
    if (!user?.id) { setMerchantLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("merchants")
        .select("province_id" as any)
        .eq("user_id", user.id)
        .maybeSingle();
      setMerchantProvinceId((data as any)?.province_id || null);
      setMerchantLoaded(true);
    })();
  }, [user?.id]);

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

  // Smart Routing V2: filter by destination district + weight range,
  // and require courier to also operate in the merchant's origin province.
  const weightNum = useMemo(() => {
    const w = parseFloat(weight);
    return isNaN(w) || w <= 0 ? 0 : w;
  }, [weight]);
  const codAmountNum = parseFloat(form.cod_amount) || 0;

  useEffect(() => {
    setSelectedCourierId("");
    setCourierOptions([]);
    if (!finalDistrictId || !merchantProvinceId || weightNum <= 0) return;
    let cancelled = false;
    (async () => {
      setLoadingCouriers(true);

      // V3 routing: use courier_coverage_areas (where) + courier_weight_tiers (price).
      // Coverage matches if courier covers the destination district OR its parent province.
      const destProvinceId = selectedProvince?.id || null;

      // Step 1: which couriers cover this destination?
      const coverageOr = [
        `district_id.eq.${finalDistrictId}`,
        ...(destProvinceId ? [`province_id.eq.${destProvinceId}`] : []),
      ].join(",");
      const { data: destCov, error: destErr } = await supabase
        .from("courier_coverage_areas" as any)
        .select("courier_id")
        .or(coverageOr);
      if (cancelled) return;
      if (destErr) {
        toast.error("تعذر جلب شركات الشحن");
        setLoadingCouriers(false);
        return;
      }
      const destCourierIds = Array.from(new Set((destCov || []).map((r: any) => r.courier_id)));

      // Step 2: which of those also cover the merchant's origin province?
      let originCourierIds = new Set<string>();
      if (destCourierIds.length > 0) {
        const { data: originCov } = await supabase
          .from("courier_coverage_areas" as any)
          .select("courier_id")
          .in("courier_id", destCourierIds)
          .eq("province_id", merchantProvinceId);
        (originCov || []).forEach((r: any) => originCourierIds.add(r.courier_id));
      }
      const validIds = destCourierIds.filter(id => originCourierIds.has(id));
      if (validIds.length === 0) {
        setCourierOptions([]);
        setLoadingCouriers(false);
        return;
      }

      // Step 3: load courier profiles + their matching weight tier
      const [{ data: couriersData }, { data: tiers }] = await Promise.all([
        supabase
          .from("couriers")
          .select("id, name, logo_url, services, is_active, cod_fee_type, cod_fee_value")
          .in("id", validIds)
          .eq("is_active", true),
        supabase
          .from("courier_weight_tiers" as any)
          .select("courier_id, min_weight, max_weight, price")
          .in("courier_id", validIds)
          .lte("min_weight", weightNum)
          .gte("max_weight", weightNum),
      ]);
      if (cancelled) return;

      const tierByCourier = new Map<string, any>();
      (tiers || []).forEach((t: any) => {
        // pick the narrowest tier in case of overlap
        const prev = tierByCourier.get(t.courier_id);
        if (!prev || (Number(t.max_weight) - Number(t.min_weight)) < (Number(prev.max_weight) - Number(prev.min_weight))) {
          tierByCourier.set(t.courier_id, t);
        }
      });

      const opts: CourierOption[] = (couriersData || [])
        .filter((c: any) => tierByCourier.has(c.id))
        .map((c: any) => {
          const t = tierByCourier.get(c.id);
          const feeType = (c.cod_fee_type as "fixed" | "percentage") || "percentage";
          const feeVal = Number(c.cod_fee_value) || 0;
          const codFee = codAmountNum > 0
            ? (feeType === "percentage" ? (codAmountNum * feeVal / 100) : feeVal)
            : 0;
          return {
            courier_id: c.id,
            name: c.name,
            logo_url: c.logo_url || null,
            services: c.services || [],
            fee: Number(t.price) || 0,
            tier_label: `${Number(t.min_weight)}–${Number(t.max_weight)} كغ`,
            cod_fee_type: feeType,
            cod_fee_value: feeVal,
            cod_fee: Math.round(codFee),
          };
        })
        .sort((a, b) => (a.fee + a.cod_fee) - (b.fee + b.cod_fee));
      setCourierOptions(opts);
      setLoadingCouriers(false);
    })();
    return () => { cancelled = true; };
  }, [finalDistrictId, merchantProvinceId, weightNum, codAmountNum, selectedProvince]);

  const selectedCourier = useMemo(
    () => courierOptions.find(c => c.courier_id === selectedCourierId) || null,
    [courierOptions, selectedCourierId]
  );

  // Carrier fee + COD fee come EXCLUSIVELY from the selected courier's rate. No defaults.
  const carrierFee = selectedCourier ? selectedCourier.fee : 0;
  const courierCodFee = selectedCourier ? selectedCourier.cod_fee : 0;
  const codAmount = codAmountNum;

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
    if (!merchantProvinceId) { toast.error("يرجى تحديث عنوان متجرك (المحافظة) من الإعدادات أولاً."); return; }
    if (weightNum <= 0) { toast.error("الرجاء إدخال وزن الشحنة بالكغ"); return; }
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
      delivery_fee: selectedCourier.fee,
      platform_fee: courierCodFee,
      net_amount: codAmount - selectedCourier.fee - courierCodFee,
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
    setSelectedProvinceId(""); setSelectedAreaId(""); setSelectedCourierId("");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-6">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">طلب شحنة جديدة</h2>
      </div>

      {merchantLoaded && !merchantProvinceId && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">العنوان غير مكتمل</p>
            <p className="text-xs mt-1">يرجى تحديث عنوان متجرك (المحافظة) من الإعدادات أولاً قبل إنشاء أي طلب شحن.</p>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span></Label>
          <Select value={selectedProvinceId} onValueChange={setSelectedProvinceId}>
            <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
            <SelectContent>{provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.province_ar}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> المنطقة
            {areas.length > 0 && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={selectedAreaId}
            onValueChange={setSelectedAreaId}
            disabled={!selectedProvinceId || areas.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !selectedProvinceId ? "اختر المحافظة أولاً" :
                areas.length === 0 ? "لا مناطق فرعية" : "اختر المنطقة"
              } />
            </SelectTrigger>
            <SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Smart Routing: Courier selection bound to district rates */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Weight className="h-3.5 w-3.5" /> وزن الشحنة (كغ) <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          min="0.1"
          step="0.1"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          required
          dir="ltr"
          placeholder="1"
        />
        <p className="text-[11px] text-muted-foreground">
          الوزن مطلوب لتحديد شركات الشحن المتاحة لهذه الفئة الوزنية.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5" /> شركة الشحن <span className="text-destructive">*</span>
        </Label>
        <Select
          value={selectedCourierId}
          onValueChange={setSelectedCourierId}
          disabled={!finalDistrictId || weightNum <= 0 || loadingCouriers || courierOptions.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={
              !finalDistrictId ? "اختر المنطقة أولاً" :
              weightNum <= 0 ? "أدخل وزن الشحنة أولاً" :
              loadingCouriers ? "جاري جلب الشركات..." :
              courierOptions.length === 0 ? "لا تغطية لهذه المنطقة" :
              "اختر شركة الشحن"
            } />
          </SelectTrigger>
          <SelectContent>
            {courierOptions.map(c => (
              <SelectItem key={c.courier_id} value={c.courier_id}>
                <div className="flex flex-col items-start gap-1 py-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-6 w-6 rounded object-cover border border-border" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 flex items-center gap-1">
                      <Weight className="h-2.5 w-2.5" /> فئة {c.tier_label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-foreground">
                      أجرة الشحن: <span className="font-bold text-primary">{c.fee.toLocaleString()} ل.س</span>
                    </span>
                    <span className="text-foreground">
                      أجور التحصيل: <span className="font-bold text-primary">{c.cod_fee.toLocaleString()} ل.س</span>
                    </span>
                  </div>
                  {c.services.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.services.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {SERVICE_LABELS[s] || s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loadingCouriers && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> جاري جلب الشركات المتاحة...
          </p>
        )}
        {finalDistrictId && !loadingCouriers && courierOptions.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>عذراً، لا توجد شركات شحن تغطي هذه المنطقة حالياً. يرجى التواصل مع الإدارة.</p>
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

      <Button type="submit" disabled={loading || lossOrder || !selectedCourier || !merchantProvinceId || weightNum <= 0} className="w-full">
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Package className="ml-2 h-4 w-4" />}
        إنشاء طلب شحن
      </Button>
    </form>
  );
}
