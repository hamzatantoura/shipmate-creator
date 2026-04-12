import { Component, type ReactNode, useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Package, Users, ScanLine } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import VendorOperationsMap from "@/components/vendor/VendorOperationsMap";
import VendorShipments from "@/components/vendor/VendorShipments";
import VendorCouriers from "@/components/vendor/VendorCouriers";
import BarcodeScanner from "@/components/vendor/BarcodeScanner";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { setupOfflineSync } from "@/lib/offline-sync";

class VendorMapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="font-display text-lg font-semibold text-foreground">تعذر تحميل خريطة العمليات حالياً</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            يمكنك متابعة إدارة الشحنات والمناديب الآن، وسأتابع إصلاح عرض الخريطة دون تعطيل حساب شركة الشحن.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function VendorDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("shipments");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  // When user clicks a row in the list, switch to map and highlight
  const handleSelectFromList = useCallback((id: string) => {
    setSelectedMerchantId(id);
    setActiveTab("map");
  }, []);

  // When user clicks a pin on the map, highlight in list
  const handleSelectFromMap = useCallback((id: string) => {
    setSelectedMerchantId(id);
  }, []);

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

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
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
            <TabsTrigger value="scanner" className="gap-1.5">
              <ScanLine className="h-3.5 w-3.5" /> ماسح الباركود
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <VendorMapErrorBoundary key={activeTab}>
              {activeTab === "map" ? (
                <VendorOperationsMap
                  selectedMerchantId={selectedMerchantId}
                  onSelectMerchant={handleSelectFromMap}
                  assignedIds={assignedIds}
                  onAssign={setAssignedIds}
                />
              ) : null}
            </VendorMapErrorBoundary>
          </TabsContent>
          <TabsContent value="shipments">
            <VendorShipments
              selectedMerchantId={selectedMerchantId}
              onSelectMerchant={handleSelectFromList}
              assignedIds={assignedIds}
            />
          </TabsContent>
          <TabsContent value="couriers"><VendorCouriers /></TabsContent>
          <TabsContent value="scanner"><BarcodeScanner /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
