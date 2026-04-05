import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Package, Truck, DollarSign, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ShipmentForm from "@/components/ShipmentForm";
import ShipmentTable from "@/components/ShipmentTable";
import { useMerchantId } from "@/hooks/use-merchant-id";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

export default function MerchantShipments() {
  const merchantId = useMerchantId();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();

  const prefill = searchParams.get("receiver_name") ? {
    receiver_name: searchParams.get("receiver_name") || "",
    phone_number: searchParams.get("phone_number") || "",
    city: searchParams.get("city") || "",
    detailed_address: searchParams.get("detailed_address") || "",
    cod_amount: searchParams.get("cod_amount") || "",
    order_id: searchParams.get("order_id") || "",
  } : undefined;

  const fetchShipments = async () => {
    const { data } = await supabase.from("shipments").select("*")
      .eq("merchant_id", merchantId).order("created_at", { ascending: false });
    if (data) setShipments(data);
  };

  useEffect(() => { fetchShipments(); }, []);

  const totalCOD = shipments.reduce((s, i) => s + Number(i.cod_amount), 0);
  const pending = shipments.filter(s => s.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "إجمالي الشحنات", value: shipments.length, icon: Package },
          { label: "قيد الانتظار", value: pending, icon: Truck },
          { label: "إجمالي COD", value: `${totalCOD.toLocaleString()} ل.س`, icon: DollarSign },
        ].map(stat => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><stat.icon className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="text-xl font-display font-bold text-foreground">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6"><ShipmentForm onCreated={fetchShipments} prefill={prefill} /></CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg text-foreground">الشحنات الأخيرة</h2>
          <div className="relative w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو رقم الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
        </div>
        <ShipmentTable shipments={shipments.filter(s => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return s.receiver_name.toLowerCase().includes(q) || s.phone_number.includes(q);
        })} />
      </div>
    </div>
  );
}
