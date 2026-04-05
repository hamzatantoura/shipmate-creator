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
import { Package, Loader2, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";

type City = Database["public"]["Enums"]["shipment_city"];

const CITIES: { value: City; label: string }[] = [
  { value: "Damascus", label: "دمشق" },
  { value: "Aleppo", label: "حلب" },
  { value: "Homs", label: "حمص" },
  { value: "Lattakia", label: "اللاذقية" },
  { value: "Hama", label: "حماة" },
  { value: "Tartous", label: "طرطوس" },
];

const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";

interface Carrier {
  id: string;
  name: string;
  name_ar: string;
  base_rate: number;
  per_kg_rate: number;
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
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [weight, setWeight] = useState("1");
  const [form, setForm] = useState({
    receiver_name: prefill?.receiver_name || "",
    phone_number: prefill?.phone_number || "",
    city: (prefill?.city || "") as City | "",
    detailed_address: prefill?.detailed_address || "",
    cod_amount: prefill?.cod_amount || "",
  });

  useEffect(() => {
    supabase.from("carriers").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setCarriers(data as Carrier[]);
    });
  }, []);

  useEffect(() => {
    if (prefill) {
      setForm({
        receiver_name: prefill.receiver_name || "",
        phone_number: prefill.phone_number || "",
        city: (prefill.city || "") as City | "",
        detailed_address: prefill.detailed_address || "",
        cod_amount: prefill.cod_amount || "",
      });
    }
  }, [prefill]);

  const carrier = carriers.find(c => c.id === selectedCarrier);
  const shippingFee = carrier ? carrier.base_rate + carrier.per_kg_rate * (parseFloat(weight) || 1) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city) { toast.error("الرجاء اختيار المدينة"); return; }
    if (!selectedCarrier) { toast.error("الرجاء اختيار شركة الشحن"); return; }

    setLoading(true);
    const tracking = `SHP-${Date.now().toString(36).toUpperCase()}`;

    // Create shipment
    const { data: shipment, error } = await supabase.from("shipments").insert({
      merchant_id: MERCHANT_ID,
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: form.city as City,
      detailed_address: form.detailed_address.trim(),
      cod_amount: parseFloat(form.cod_amount) || 0,
      tracking_number: tracking,
      carrier_id: selectedCarrier,
      final_weight: parseFloat(weight) || 1,
      shipping_fee: shippingFee,
      order_id: prefill?.order_id || null,
    } as any).select().single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    // Deduct shipping fee from wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("merchant_id", MERCHANT_ID)
      .single();

    if (wallet) {
      const newBalance = Number(wallet.balance) - shippingFee;
      await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);
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
      await supabase.from("orders").update({
        shipment_id: shipment.id,
        status: "shipped",
      } as any).eq("id", prefill.order_id);
    }

    setLoading(false);
    toast.success("تم إنشاء الشحنة وخصم رسوم الشحن!");
    setForm({ receiver_name: "", phone_number: "", city: "", detailed_address: "", cod_amount: "" });
    setSelectedCarrier("");
    setWeight("1");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-6">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">شحنة جديدة</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="receiver_name">اسم المستلم</Label>
          <Input id="receiver_name" placeholder="الاسم الكامل" value={form.receiver_name}
            onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone_number">رقم الهاتف</Label>
          <Input id="phone_number" placeholder="+963 9XX XXX XXX" value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>المدينة</Label>
          <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v as City })}>
            <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cod_amount">مبلغ الدفع عند الاستلام (ل.س)</Label>
          <Input id="cod_amount" type="number" min="0" step="0.01" placeholder="0.00" value={form.cod_amount}
            onChange={(e) => setForm({ ...form, cod_amount: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="detailed_address">العنوان التفصيلي</Label>
        <Textarea id="detailed_address" placeholder="الشارع، البناء، الطابق..." value={form.detailed_address}
          onChange={(e) => setForm({ ...form, detailed_address: e.target.value })} required rows={3} />
      </div>

      {/* Carrier Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2"><Truck className="h-4 w-4" /> شركة الشحن</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {carriers.map(c => (
            <Card
              key={c.id}
              className={`cursor-pointer transition-all ${selectedCarrier === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
              onClick={() => setSelectedCarrier(c.id)}
            >
              <CardContent className="p-3 text-center">
                <p className="font-semibold text-foreground">{c.name_ar}</p>
                <p className="text-xs text-muted-foreground">{c.name}</p>
                <p className="text-sm text-primary font-display font-bold mt-1">
                  {Number(c.base_rate).toLocaleString()} + {Number(c.per_kg_rate).toLocaleString()}/كغ
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedCarrier && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الوزن (كغ)</Label>
            <Input type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
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
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Package className="ml-2 h-4 w-4" />}
        إنشاء شحنة
      </Button>
    </form>
  );
}
