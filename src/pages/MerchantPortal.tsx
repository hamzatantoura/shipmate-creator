import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Wallet, Truck, ArrowDownCircle } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import ShipmentForm from "@/components/ShipmentForm";
import ShipmentTable from "@/components/ShipmentTable";
import MerchantProducts from "@/components/merchant/MerchantProducts";
import MerchantOrders from "@/components/merchant/MerchantOrders";
import MerchantWallet from "@/components/merchant/MerchantWallet";
import MerchantShipments from "@/components/merchant/MerchantShipments";

export default function MerchantPortal() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6">لوحة التاجر</h1>

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

          <TabsContent value="shipments">
            <MerchantShipments />
          </TabsContent>
          <TabsContent value="products">
            <MerchantProducts />
          </TabsContent>
          <TabsContent value="orders">
            <MerchantOrders />
          </TabsContent>
          <TabsContent value="wallet">
            <MerchantWallet />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
