import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Package, Truck, DollarSign } from "lucide-react";
import ShipmentForm from "@/components/ShipmentForm";
import ShipmentTable from "@/components/ShipmentTable";
import AuthForm from "@/components/AuthForm";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchShipments = async () => {
    const { data } = await supabase.from("shipments").select("*").order("created_at", { ascending: false });
    if (data) setShipments(data);
  };

  useEffect(() => {
    if (session) fetchShipments();
  }, [session]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!session) return <AuthForm />;

  const totalCOD = shipments.reduce((s, i) => s + Number(i.cod_amount), 0);
  const pending = shipments.filter((s) => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">ShipDash</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Shipments", value: shipments.length, icon: Package },
            { label: "Pending", value: pending, icon: Truck },
            { label: "Total COD", value: `${totalCOD.toLocaleString()} SYP`, icon: DollarSign },
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
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Recent Shipments</h2>
          <ShipmentTable shipments={shipments} />
        </div>
      </main>
    </div>
  );
}
