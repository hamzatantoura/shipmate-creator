import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Loader2, Truck, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
const MERCHANT_PROVINCE = "Damascus"; // merchant's origin city for intra/inter calc

interface Province {
  id: string;
  name: string;
  name_ar: string;
}

interface SubRegion {
  id: string;
  province_id: string;
  name: string;
  name_ar: string;
}

interface Carrier {
  id: string;
  name: string;
  name_ar: string;
  base_rate: number;
  per_kg_rate: number;
}

interface CarrierCoverage {
  id: string;
  carrier_id: string;
  province_id: string;
  intra_city_rate: number;
  inter_city_rate: number;
  is_available: boolean;
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

export default function ShipmentForm({ onCreated, prefill }: ShipmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [coverages, setCoverages] = useState<CarrierCoverage[]>([]);

  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedSubRegion, setSelectedSubRegion] = useState("");
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [weight, setWeight] = useState("1");

  const [form, setForm] = useState({
    receiver_name: prefill?.receiver_name || "",
    phone_number: prefill?.phone_number || "",
    detailed_address: prefill?.detailed_address || "",
    cod_amount: prefill?.cod_amount || "",
  });

  // Load provinces and carriers on mount
  useEffect(() => {
    Promise.all([
      supabase.from("provinces").select("*").order("name_ar"),
      supabase.from("carriers").select("*").eq("is_active", true),
      supabase.from("carrier_coverage").select("*").eq("is_available", true),
    ]).then(([provRes, carrRes, covRes]) => {
      if (provRes.data) setProvinces(provRes.data as Province[]);
      if (carrRes.data) setCarriers(carrRes.data as Carrier[]);
      if (covRes.data) setCoverages(covRes.data as CarrierCoverage[]);
    });
  }, []);

  // Load sub-regions when province changes
  useEffect(() => {
    setSelectedSubRegion("");
    setSelectedCarrier("");
    if (!selectedProvince) {
      setSubRegions([]);
      return;
    }
    supabase
      .from("sub_regions")
      .select("*")
      .eq("province_id", selectedProvince)
      .order("name_ar")
      .then(({ data }) => {
        if (data) setSubRegions(data as SubRegion[]);
      });
  }, [selectedProvince]);

  // Prefill province matching
  useEffect(() => {
    if (prefill?.city && provinces.length > 0) {
      const match = provinces.find(
        (p) => p.name === prefill.city || p.name_ar === prefill.city
      );
      if (match) setSelectedProvince(match.id);
    }
    if (prefill) {
      setForm({
        receiver_name: prefill.receiver_name || "",
        phone_number: prefill.phone_number || "",
        detailed_address: prefill.detailed_address || "",
        cod_amount: prefill.cod_amount || "",
      });
    }
  }, [prefill, provinces]);

  // Filter carriers that serve the selected province
  const availableCarriers = selectedProvince
    ? carriers.filter((c) =>
        coverages.some(
          (cov) =>
            cov.carrier_id === c.id && cov.province_id === selectedProvince
        )
      )
    : [];

  // Determine if intra or inter city
  const merchantProvince = provinces.find((p) => p.name === MERCHANT_PROVINCE);
  const isIntraCity = merchantProvince?.id === selectedProvince;

  // Get coverage-based rate for selected carrier + province
  const coverage = coverages.find(
    (cov) =>
      cov.carrier_id === selectedCarrier &&
      cov.province_id === selectedProvince
  );
  const locationRate = coverage
    ? isIntraCity
      ? Number(coverage.intra_city_rate)
      : Number(coverage.inter_city_rate)
    : 0;

  // Total shipping fee = location rate + per_kg surcharge
  // The 2,000 SYP platform markup is added internally but NOT shown to merchant
  const PLATFORM_MARKUP = 2000;
  const carrier = carriers.find((c) => c.id === selectedCarrier);
  const visibleShippingFee = carrier
    ? locationRate + carrier.per_kg_rate * (parseFloat(weight) || 1)
    : 0;
  const shippingFee = visibleShippingFee; // actual deduction; markup applied at settlement

  const selectedProvinceName = provinces.find((p) => p.id === selectedProvince);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvince) {
      toast.error("الرجاء اختيار المحافظة");
      return;
    }
    if (!selectedCarrier) {
      toast.error("الرجاء اختيار شركة الشحن");
      return;
    }

    setLoading(true);
    const tracking = `SHP-${Date.now().toString(36).toUpperCase()}`;
    const provinceName = selectedProvinceName?.name || "";
    const subRegionName =
      subRegions.find((s) => s.id === selectedSubRegion)?.name_ar || "";
    const cityLabel = `${selectedProvinceName?.name_ar || ""} - ${subRegionName}`.trim();

    const { data: shipment, error } = await supabase
      .from("shipments")
      .insert({
        merchant_id: MERCHANT_ID,
        receiver_name: form.receiver_name.trim(),
        phone_number: form.phone_number.trim(),
        city: mapProvinceToCity(provinceName),
        detailed_address: `${subRegionName ? subRegionName + "، " : ""}${form.detailed_address.trim()}`,
        cod_amount: parseFloat(form.cod_amount) || 0,
        tracking_number: tracking,
        carrier_id: selectedCarrier,
        final_weight: parseFloat(weight) || 1,
        shipping_fee: shippingFee,
        order_id: prefill?.order_id || null,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Deduct shipping fee from wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("merchant_id", MERCHANT_ID)
      .single();

    if (wallet) {
      const newBalance = Number(wallet.balance) - shippingFee;
      await supabase
        .from("wallets")
        .update({ balance: newBalance } as any)
        .eq("id", wallet.id);
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "shipping_fee",
        amount: -shippingFee,
        description: `رسوم شحن - ${tracking}`,
        reference_id: shipment?.id,
      } as any);
    }

    // Update order if linked
    if (prefill?.order_id && shipment) {
      await supabase
        .from("orders")
        .update({
          shipment_id: shipment.id,
          status: "shipped",
        } as any)
        .eq("id", prefill.order_id);
    }

    setLoading(false);
    toast.success("تم إنشاء الشحنة وخصم رسوم الشحن!");
    setForm({
      receiver_name: "",
      phone_number: "",
      detailed_address: "",
      cod_amount: "",
    });
    setSelectedProvince("");
    setSelectedSubRegion("");
    setSelectedCarrier("");
    setWeight("1");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-6">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">
          شحنة جديدة
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="receiver_name">اسم المستلم</Label>
          <Input
            id="receiver_name"
            placeholder="الاسم الكامل"
            value={form.receiver_name}
            onChange={(e) =>
              setForm({ ...form, receiver_name: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone_number">رقم الهاتف</Label>
          <Input
            id="phone_number"
            placeholder="+963 9XX XXX XXX"
            value={form.phone_number}
            onChange={(e) =>
              setForm({ ...form, phone_number: e.target.value })
            }
            required
          />
        </div>

        {/* Province */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> المحافظة
          </Label>
          <Select
            value={selectedProvince}
            onValueChange={setSelectedProvince}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sub-region */}
        <div className="space-y-2">
          <Label>المنطقة</Label>
          <Select
            value={selectedSubRegion}
            onValueChange={setSelectedSubRegion}
            disabled={!selectedProvince || subRegions.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !selectedProvince
                    ? "اختر المحافظة أولاً"
                    : subRegions.length === 0
                    ? "لا توجد مناطق"
                    : "اختر المنطقة"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subRegions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cod_amount">مبلغ الدفع عند الاستلام (ل.س)</Label>
          <Input
            id="cod_amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.cod_amount}
            onChange={(e) =>
              setForm({ ...form, cod_amount: e.target.value })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="detailed_address">العنوان التفصيلي</Label>
        <Textarea
          id="detailed_address"
          placeholder="الشارع، البناء، الطابق..."
          value={form.detailed_address}
          onChange={(e) =>
            setForm({ ...form, detailed_address: e.target.value })
          }
          required
          rows={3}
        />
      </div>

      {/* Shipping type indicator */}
      {selectedProvince && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">نوع الشحن:</span>
          <span
            className={`font-semibold ${
              isIntraCity ? "text-primary" : "text-accent-foreground"
            }`}
          >
            {isIntraCity ? "🏙️ داخل المدينة" : "🚛 بين المدن"}
          </span>
          {selectedProvinceName && (
            <span className="text-muted-foreground text-xs">
              (من دمشق إلى {selectedProvinceName.name_ar})
            </span>
          )}
        </div>
      )}

      {/* Carrier Selection — only carriers serving selected province */}
      {selectedProvince && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Truck className="h-4 w-4" /> شركات الشحن المتاحة
          </Label>
          {availableCarriers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا توجد شركات شحن تخدم هذه المحافظة
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableCarriers.map((c) => {
                const cov = coverages.find(
                  (cv) =>
                    cv.carrier_id === c.id &&
                    cv.province_id === selectedProvince
                );
                const rate = cov
                  ? isIntraCity
                    ? Number(cov.intra_city_rate)
                    : Number(cov.inter_city_rate)
                  : 0;
                return (
                  <Card
                    key={c.id}
                    className={`cursor-pointer transition-all ${
                      selectedCarrier === c.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                    onClick={() => setSelectedCarrier(c.id)}
                  >
                    <CardContent className="p-3 text-center">
                      <p className="font-semibold text-foreground">
                        {c.name_ar}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.name}</p>
                      <p className="text-sm text-primary font-display font-bold mt-1">
                        {rate.toLocaleString()} ل.س
                      </p>
                      <p className="text-xs text-muted-foreground">
                        + {Number(c.per_kg_rate).toLocaleString()}/كغ
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedCarrier && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الوزن (كغ)</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>رسوم الشحن المحسوبة</Label>
            <div className="h-10 rounded-md border border-border bg-muted/30 flex items-center px-3 font-display font-bold text-primary">
              {shippingFee.toLocaleString()} ل.س
            </div>
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
        ) : (
          <Package className="ml-2 h-4 w-4" />
        )}
        إنشاء شحنة
      </Button>
    </form>
  );
}

// Map province name to the shipment_city enum
function mapProvinceToCity(
  provinceName: string
): "Damascus" | "Aleppo" | "Homs" | "Lattakia" | "Hama" | "Tartous" {
  const map: Record<string, any> = {
    Damascus: "Damascus",
    "Rif Dimashq": "Damascus",
    Aleppo: "Aleppo",
    Homs: "Homs",
    Hama: "Hama",
    Lattakia: "Lattakia",
    Tartous: "Tartous",
  };
  return map[provinceName] || "Damascus";
}
