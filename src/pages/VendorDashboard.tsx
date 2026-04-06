import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Package, Users } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import VendorOperationsMap from "@/components/vendor/VendorOperationsMap";
import VendorShipments from "@/components/vendor/VendorShipments";
import VendorCouriers from "@/components/vendor/VendorCouriers";
import { useAuth } from "@/hooks/use-auth";

export default function VendorDashboard() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground">لوحة شركة الشحن</h1>
          {profile?.store_name && (
            <p className="text-sm text-muted-foreground mt-1">{profile.store_name}</p>
          )}
        </div>

        <Tabs defaultValue="map" dir="rtl">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="map" className="gap-1.5">
              <Map className="h-3.5 w-3.5" /> خريطة العمليات
            </TabsTrigger>
            <TabsTrigger value="shipments" className="gap-1.5">
              <Package className="h-3.5 w-3.5" /> الشحنات
            </TabsTrigger>
            <TabsTrigger value="couriers" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> المناديب
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map"><VendorOperationsMap /></TabsContent>
          <TabsContent value="shipments"><VendorShipments /></TabsContent>
          <TabsContent value="couriers"><VendorCouriers /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
