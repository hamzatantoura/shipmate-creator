import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, Wallet, Truck, Settings } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import MerchantProducts from "@/components/merchant/MerchantProducts";
import MerchantOrders from "@/components/merchant/MerchantOrders";
import MerchantWallet from "@/components/merchant/MerchantWallet";
import MerchantShipments from "@/components/merchant/MerchantShipments";
import MerchantShippingSettings from "@/components/merchant/MerchantShippingSettings";
import MerchantVerificationGate from "@/components/merchant/MerchantVerificationGate";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "react-router-dom";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

export default function MerchantPortal() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "shipments";
  useRealtimeNotifications("merchant");

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground">لوحة التاجر</h1>
          {profile?.store_name && (
            <p className="text-sm text-muted-foreground mt-1">{profile.store_name}</p>
          )}
        </div>

        <Tabs defaultValue={defaultTab} dir="rtl">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="shipments" className="gap-1.5">
              <Truck className="h-3.5 w-3.5" /> الشحنات
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="h-3.5 w-3.5" /> المنتجات
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> الطلبات
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> المحفظة
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" /> الإعدادات
            </TabsTrigger>
          </TabsList>

          {/* Operational tabs gated by verification */}
          <TabsContent value="shipments">
            <MerchantVerificationGate>
              <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الشحنات">
                <MerchantShipments />
              </ErrorBoundary>
            </MerchantVerificationGate>
          </TabsContent>
          <TabsContent value="products">
            <MerchantVerificationGate>
              <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المنتجات">
                <MerchantProducts />
              </ErrorBoundary>
            </MerchantVerificationGate>
          </TabsContent>
          <TabsContent value="orders">
            <MerchantVerificationGate>
              <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الطلبات">
                <MerchantOrders />
              </ErrorBoundary>
            </MerchantVerificationGate>
          </TabsContent>
          <TabsContent value="wallet">
            <MerchantVerificationGate>
              <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المحفظة">
                <MerchantWallet />
              </ErrorBoundary>
            </MerchantVerificationGate>
          </TabsContent>
          {/* Settings always accessible for completing data */}
          <TabsContent value="settings">
            <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الإعدادات">
              <MerchantShippingSettings />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
