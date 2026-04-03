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

        {/* Search + Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-foreground">الشحنات الأخيرة</h2>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>
          <ShipmentTable
            shipments={shipments.filter((s) => {
              if (!search.trim()) return true;
              const q = search.trim().toLowerCase();
              return (
                s.receiver_name.toLowerCase().includes(q) ||
                s.phone_number.includes(q)
              );
            })}
          />
        </div>
      </main>
    </div>
  );
}
