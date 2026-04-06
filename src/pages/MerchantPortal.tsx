import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, Wallet, Truck } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import MerchantProducts from "@/components/merchant/MerchantProducts";
import MerchantOrders from "@/components/merchant/MerchantOrders";
import MerchantWallet from "@/components/merchant/MerchantWallet";
import MerchantShipments from "@/components/merchant/MerchantShipments";
import { useAuth } from "@/hooks/use-auth";

export default function MerchantPortal() {
  const { profile } = useAuth();

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

        <Tabs defaultValue="shipments" dir="rtl">
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

          <TabsContent value="shipments"><MerchantShipments /></TabsContent>
          <TabsContent value="products"><MerchantProducts /></TabsContent>
          <TabsContent value="orders"><MerchantOrders /></TabsContent>
          <TabsContent value="wallet"><MerchantWallet /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
