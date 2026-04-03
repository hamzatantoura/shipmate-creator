import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Package, Truck, DollarSign, Search } from "lucide-react";
import ShipmentForm from "@/components/ShipmentForm";
import ShipmentTable from "@/components/ShipmentTable";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

export default function Index() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState("");

  const fetchShipments = async () => {
    const { data } = await supabase.from("shipments").select("*").order("created_at", { ascending: false });
    if (data) setShipments(data);
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const totalCOD = shipments.reduce((s, i) => s + Number(i.cod_amount), 0);
  const pending = shipments.filter((s) => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">ShipDash</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "إجمالي الشحنات", value: shipments.length, icon: Package },
            { label: "قيد الانتظار", value: pending, icon: Truck },
            { label: "إجمالي الدفع عند الاستلام", value: `${totalCOD.toLocaleString()} ل.س`, icon: DollarSign },
          ].map((stat) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Form */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <ShipmentForm onCreated={fetchShipments} />
          </CardContent>
        </Card>

        {/* Table */}
        <div>
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">الشحنات الأخيرة</h2>
          <ShipmentTable shipments={shipments} />
        </div>
      </main>
    </div>
  );
}
