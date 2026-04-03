import { useState } from "react";
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
import { Package, Loader2 } from "lucide-react";
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

interface ShipmentFormProps {
  onCreated: () => void;
}

export default function ShipmentForm({ onCreated }: ShipmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    receiver_name: "",
    phone_number: "",
    city: "" as City | "",
    detailed_address: "",
    cod_amount: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city) {
      toast.error("الرجاء اختيار المدينة");
      return;
    }

    setLoading(true);
    const tracking = `SHP-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabase.from("shipments").insert({
      merchant_id: "00000000-0000-0000-0000-000000000000",
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: form.city as City,
      detailed_address: form.detailed_address.trim(),
      cod_amount: parseFloat(form.cod_amount) || 0,
      tracking_number: tracking,
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إنشاء الشحنة بنجاح!");
      setForm({ receiver_name: "", phone_number: "", city: "", detailed_address: "", cod_amount: "" });
      onCreated();
    }
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
          <Input
            id="receiver_name"
            placeholder="الاسم الكامل"
            value={form.receiver_name}
            onChange={(e) => setForm({ ...form, receiver_name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone_number">رقم الهاتف</Label>
          <Input
            id="phone_number"
            placeholder="+963 9XX XXX XXX"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>المدينة</Label>
          <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v as City })}>
            <SelectTrigger>
              <SelectValue placeholder="اختر المدينة" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
            onChange={(e) => setForm({ ...form, cod_amount: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="detailed_address">العنوان التفصيلي</Label>
        <Textarea
          id="detailed_address"
          placeholder="الشارع، البناء، الطابق..."
          value={form.detailed_address}
          onChange={(e) => setForm({ ...form, detailed_address: e.target.value })}
          required
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Package className="ml-2 h-4 w-4" />}
        إنشاء شحنة
      </Button>
    </form>
  );
}
