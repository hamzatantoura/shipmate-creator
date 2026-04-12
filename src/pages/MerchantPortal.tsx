import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, Wallet, Truck } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import ErrorBoundary from "@/components/ErrorBoundary";
import MerchantProducts from "@/components/merchant/MerchantProducts";
import MerchantOrders from "@/components/merchant/MerchantOrders";
import MerchantWallet from "@/components/merchant/MerchantWallet";
import MerchantShipments from "@/components/merchant/MerchantShipments";
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
          </TabsList>

          <TabsContent value="shipments">
            <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الشحنات">
              <MerchantShipments />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="products">
            <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المنتجات">
              <MerchantProducts />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="orders">
            <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الطلبات">
              <MerchantOrders />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="wallet">
            <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المحفظة">
              <MerchantWallet />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
