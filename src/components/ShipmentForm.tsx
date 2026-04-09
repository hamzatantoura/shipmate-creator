import { useState, useEffect } from "react";
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

interface District {
  id: string;
  province: string;
  province_ar: string;
  area: string | null;
  area_ar: string | null;
  delivery_fee: number;
}

interface SubRegion {
  id: string;
  name: string;
  name_ar: string;
  province_id: string;
}

interface Province {
  id: string;
  name: string;
  name_ar: string;
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

export default function ShipmentForm({ onCreated, prefill }: ShipmentFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [filteredSubRegions, setFilteredSubRegions] = useState<SubRegion[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSubRegion, setSelectedSubRegion] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [form, setForm] = useState({
    receiver_name: prefill?.receiver_name || "",
    phone_number: prefill?.phone_number || "",
    detailed_address: prefill?.detailed_address || "",
    cod_amount: prefill?.cod_amount || "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("districts").select("*").eq("is_active", true).order("province_ar"),
      supabase.from("provinces").select("*").order("name_ar"),
      supabase.from("sub_regions").select("*").order("name_ar"),
    ]).then(([distRes, provRes, subRes]) => {
      if (distRes.data) setDistricts(distRes.data as any as District[]);
      if (provRes.data) setProvinces(provRes.data as any as Province[]);
      if (subRes.data) setSubRegions(subRes.data as any as SubRegion[]);
    });
  }, []);

  useEffect(() => {
    if (prefill?.city && districts.length > 0) {
      const match = districts.find(d => d.province_ar === prefill.city || d.province === prefill.city);
      if (match) setSelectedDistrict(match.id);
    }
    if (prefill) {
      setForm({
        receiver_name: prefill.receiver_name || "",
        phone_number: prefill.phone_number || "",
        detailed_address: prefill.detailed_address || "",
        cod_amount: prefill.cod_amount || "",
        neighborhood: "",
      });
    }
  }, [prefill, districts]);

  const selectedDistrictObj = districts.find(d => d.id === selectedDistrict);
  const deliveryFee = selectedDistrictObj ? Number(selectedDistrictObj.delivery_fee) : 0;

  const mapToCity = (province: string): "Damascus" | "Aleppo" | "Homs" | "Lattakia" | "Hama" | "Tartous" => {
    const map: Record<string, any> = {
      Damascus: "Damascus", "Rural Damascus": "Damascus", Aleppo: "Aleppo",
      Homs: "Homs", Hama: "Hama", Lattakia: "Lattakia", Tartous: "Tartous",
    };
    return map[province] || "Damascus";
  };

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
    if (!selectedDistrict) { toast.error("الرجاء اختيار المحافظة"); return; }
    if (!validatePhone(form.phone_number)) { toast.error("رقم الهاتف غير صحيح"); return; }

    setLoading(true);
    const tracking = `SIL-${Date.now().toString(36).toUpperCase()}`;
    const codAmount = parseFloat(form.cod_amount) || 0;

    const { data: order, error: orderErr } = await supabase.from("orders").insert({
      merchant_id: user?.id || "",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: selectedDistrictObj?.province_ar || "",
      detailed_address: form.detailed_address.trim(),
      total_amount: codAmount,
      delivery_fee: deliveryFee,
      platform_fee: codAmount * 0.05,
      net_amount: codAmount - deliveryFee - (codAmount * 0.05),
      district_id: selectedDistrict,
      customer_lat: null,
      customer_lng: null,
      status: "new",
    } as any).select().single();

    if (orderErr) {
      toast.error(orderErr.message);
      setLoading(false);
      return;
    }

    const { error: shipErr } = await supabase.from("shipments").insert({
      merchant_id: user?.id || "",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: mapToCity(selectedDistrictObj?.province || ""),
      detailed_address: form.detailed_address.trim(),
      cod_amount: codAmount,
      tracking_number: tracking,
      shipping_fee: deliveryFee,
      order_id: (order as any)?.id || prefill?.order_id || null,
      status: "pending",
    } as any);

    if (shipErr) {
      toast.error(shipErr.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    toast.success(`تم إنشاء الطلب والشحنة — رقم التتبع: ${tracking}`);
    setForm({ receiver_name: "", phone_number: "", detailed_address: "", cod_amount: "", neighborhood: "" });
    setSelectedDistrict("");
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

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span></Label>
          <Select value={selectedDistrict} onValueChange={setSelectedDistrict} required>
            <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
            <SelectContent>
              {districts.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.province_ar} {d.area_ar ? `— ${d.area_ar}` : ""} ({Number(d.delivery_fee).toLocaleString()} ل.س)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>مبلغ الدفع عند الاستلام (ل.س)</Label>
          <Input type="number" min="0" step="1" placeholder="0" value={form.cod_amount} onChange={e => setForm({ ...form, cod_amount: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>العنوان التفصيلي <span className="text-destructive">*</span></Label>
        <Textarea placeholder="الشارع، البناء، الطابق..." value={form.detailed_address} onChange={e => setForm({ ...form, detailed_address: e.target.value })} required rows={3} />
      </div>

      <div className="space-y-2">
        <Label>الحي / المنطقة</Label>
        <Input placeholder="مثال: الجميلية، المزة، باب توما..." value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
      </div>

      {selectedDistrict && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border">
          <div>
            <p className="text-sm text-muted-foreground">رسوم التوصيل</p>
            <p className="text-lg font-display font-bold text-primary">{deliveryFee.toLocaleString()} ل.س</p>
          </div>
          {form.cod_amount && (
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
