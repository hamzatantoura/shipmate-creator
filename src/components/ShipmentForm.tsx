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
import { Package, Loader2, MapPin, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ShippingZone {
  id: string;
  province_name: string;
  province_name_ar: string;
  area_name: string | null;
  area_name_ar: string | null;
  neighborhood_name: string | null;
  neighborhood_name_ar: string | null;
  delivery_fee: number;
  carrier_id: string | null;
}

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

const SYRIA_PHONE_REGEX = /^(\+?963|0)?9\d{8}$/;
function validatePhone(phone: string): boolean {
  return SYRIA_PHONE_REGEX.test(phone.replace(/[\s-]/g, ""));
}

const CITY_MAP: Record<string, "Damascus" | "Aleppo" | "Homs" | "Lattakia" | "Hama" | "Tartous"> = {
  Damascus: "Damascus", "Rural Damascus": "Damascus", Aleppo: "Aleppo",
  Homs: "Homs", Hama: "Hama", Lattakia: "Lattakia", Tartous: "Tartous",
};

export default function ShipmentForm({ onCreated, prefill }: ShipmentFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<ShippingZone[]>([]);

  // Cascading selection state
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");

  const [phoneError, setPhoneError] = useState("");
  const [form, setForm] = useState({
    receiver_name: prefill?.receiver_name || "",
    phone_number: prefill?.phone_number || "",
    detailed_address: prefill?.detailed_address || "",
    cod_amount: prefill?.cod_amount || "",
  });

  // Load zones
  useEffect(() => {
    supabase
      .from("shipping_zones")
      .select("*")
      .eq("is_active", true)
      .order("province_name_ar")
      .then(({ data }) => {
        if (data) setZones(data as any);
      });
  }, []);

  // Prefill
  useEffect(() => {
    if (prefill) {
      setForm({
        receiver_name: prefill.receiver_name || "",
        phone_number: prefill.phone_number || "",
        detailed_address: prefill.detailed_address || "",
        cod_amount: prefill.cod_amount || "",
      });
      if (prefill.city && zones.length > 0) {
        const match = zones.find(
          z => z.province_name_ar === prefill.city || z.province_name === prefill.city
        );
        if (match) setSelectedProvince(match.province_name);
      }
    }
  }, [prefill, zones]);

  // Derived lists
  const provinces = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach(z => map.set(z.province_name, z.province_name_ar));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ar"));
  }, [zones]);

  const areas = useMemo(() => {
    if (!selectedProvince) return [];
    const map = new Map<string, string>();
    zones
      .filter(z => z.province_name === selectedProvince && z.area_name)
      .forEach(z => map.set(z.area_name!, z.area_name_ar!));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ar"));
  }, [zones, selectedProvince]);

  const neighborhoods = useMemo(() => {
    if (!selectedProvince || !selectedArea) return [];
    return zones
      .filter(
        z =>
          z.province_name === selectedProvince &&
          z.area_name === selectedArea &&
          z.neighborhood_name
      )
      .map(z => ({ name: z.neighborhood_name!, name_ar: z.neighborhood_name_ar! }))
      .sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"));
  }, [zones, selectedProvince, selectedArea]);

  // Reset downstream when upstream changes
  useEffect(() => { setSelectedArea(""); setSelectedNeighborhood(""); }, [selectedProvince]);
  useEffect(() => { setSelectedNeighborhood(""); }, [selectedArea]);

  // Find the matching zone for pricing
  const matchedZone = useMemo(() => {
    if (!selectedProvince) return null;
    // Try most specific first: neighborhood
    if (selectedNeighborhood) {
      const z = zones.find(
        z => z.province_name === selectedProvince && z.area_name === selectedArea && z.neighborhood_name === selectedNeighborhood
      );
      if (z) return z;
    }
    // Then area
    if (selectedArea) {
      const z = zones.find(
        z => z.province_name === selectedProvince && z.area_name === selectedArea && !z.neighborhood_name
      );
      if (z) return z;
    }
    // Then province
    const z = zones.find(
      z => z.province_name === selectedProvince && !z.area_name && !z.neighborhood_name
    );
    return z || null;
  }, [zones, selectedProvince, selectedArea, selectedNeighborhood]);

  const deliveryFee = matchedZone ? Number(matchedZone.delivery_fee) : 0;

  const handlePhoneChange = (val: string) => {
    setForm({ ...form, phone_number: val });
    if (val && !validatePhone(val)) {
      setPhoneError("صيغة الرقم غير صحيحة. مثال: 0912345678 أو +963912345678");
    } else {
      setPhoneError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvince) { toast.error("الرجاء اختيار المحافظة"); return; }
    if (!validatePhone(form.phone_number)) { toast.error("رقم الهاتف غير صحيح"); return; }

    setLoading(true);
    const tracking = `SIL-${Date.now().toString(36).toUpperCase()}`;
    const codAmount = parseFloat(form.cod_amount) || 0;
    const provinceAr = provinces.find(p => p[0] === selectedProvince)?.[1] || selectedProvince;
    const cityEnum = CITY_MAP[selectedProvince] || "Damascus";

    const { data: order, error: orderErr } = await supabase.from("orders").insert({
      merchant_id: user?.id || "",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: provinceAr,
      detailed_address: form.detailed_address.trim(),
      total_amount: codAmount,
      delivery_fee: deliveryFee,
      platform_fee: codAmount * 0.05,
      net_amount: codAmount - deliveryFee - (codAmount * 0.05),
      customer_lat: null,
      customer_lng: null,
      status: "new",
    } as any).select().single();

    if (orderErr) { toast.error(orderErr.message); setLoading(false); return; }

    const { error: shipErr } = await supabase.from("shipments").insert({
      merchant_id: user?.id || "",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: cityEnum,
      detailed_address: form.detailed_address.trim(),
      cod_amount: codAmount,
      tracking_number: tracking,
      shipping_fee: deliveryFee,
      order_id: (order as any)?.id || prefill?.order_id || null,
      carrier_id: matchedZone?.carrier_id || null,
      status: "pending",
    } as any);

    if (shipErr) { toast.error(shipErr.message); setLoading(false); return; }

    setLoading(false);
    toast.success(`تم إنشاء الطلب والشحنة — رقم التتبع: ${tracking}`);
    setForm({ receiver_name: "", phone_number: "", detailed_address: "", cod_amount: "" });
    setSelectedProvince("");
    setSelectedArea("");
    setSelectedNeighborhood("");
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
          <Input
            placeholder="0912345678"
            value={form.phone_number}
            onChange={e => handlePhoneChange(e.target.value)}
            required dir="ltr"
            className={phoneError ? "border-destructive" : ""}
          />
          {phoneError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {phoneError}
            </p>
          )}
        </div>
      </div>

      {/* Cascading location selects */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Province */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span>
          </Label>
          <Select value={selectedProvince} onValueChange={setSelectedProvince}>
            <SelectTrigger>
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map(([name, nameAr]) => (
                <SelectItem key={name} value={name}>{nameAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Area */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> المنطقة
          </Label>
          <Select
            value={selectedArea}
            onValueChange={setSelectedArea}
            disabled={areas.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedProvince ? (areas.length > 0 ? "اختر المنطقة" : "لا توجد مناطق") : "اختر المحافظة أولاً"} />
            </SelectTrigger>
            <SelectContent>
              {areas.map(([name, nameAr]) => (
                <SelectItem key={name} value={name}>{nameAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Neighborhood */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> الحي
          </Label>
          <Select
            value={selectedNeighborhood}
            onValueChange={setSelectedNeighborhood}
            disabled={neighborhoods.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedArea ? (neighborhoods.length > 0 ? "اختر الحي" : "لا توجد أحياء") : "اختر المنطقة أولاً"} />
            </SelectTrigger>
            <SelectContent>
              {neighborhoods.map(n => (
                <SelectItem key={n.name} value={n.name}>{n.name_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>العنوان التفصيلي <span className="text-destructive">*</span></Label>
          <Textarea placeholder="الشارع، البناء، الطابق..." value={form.detailed_address} onChange={e => setForm({ ...form, detailed_address: e.target.value })} required rows={3} />
        </div>
        <div className="space-y-2">
          <Label>مبلغ الدفع عند الاستلام (ل.س)</Label>
          <Input type="number" min="0" step="1" placeholder="0" value={form.cod_amount} onChange={e => setForm({ ...form, cod_amount: e.target.value })} />
        </div>
      </div>

      {selectedProvince && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border">
          <div>
            <p className="text-sm text-muted-foreground">رسوم التوصيل</p>
            <p className="text-lg font-display font-bold text-primary">
              {deliveryFee > 0 ? `${deliveryFee.toLocaleString()} ل.س` : "غير محدد لهذه المنطقة"}
            </p>
          </div>
          {form.cod_amount && parseFloat(form.cod_amount) > 0 && (
            <>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground">عمولة المنصة (5%)</p>
                <p className="text-lg font-display font-bold text-foreground">{(parseFloat(form.cod_amount) * 0.05).toLocaleString()} ل.س</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground">صافي الربح</p>
                <p className="text-lg font-display font-bold text-primary">
                  {(parseFloat(form.cod_amount) - deliveryFee - parseFloat(form.cod_amount) * 0.05).toLocaleString()} ل.س
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Package className="ml-2 h-4 w-4" />}
        إنشاء طلب شحن
      </Button>
    </form>
  );
}
