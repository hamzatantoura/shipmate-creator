import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import { AuthProvider } from "@/hooks/use-auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantOrdersPage from "./pages/MerchantOrdersPage";
import MerchantWalletPage from "./pages/MerchantWalletPage";
import MerchantProductsPage from "./pages/MerchantProductsPage";
import MerchantSettingsPage from "./pages/MerchantSettingsPage";
import CourierOrders from "./pages/CourierOrders";
import CourierWallet from "./pages/CourierWallet";
import TopUp from "./pages/TopUp";
import AdminLogistics from "./pages/AdminLogistics";
import AdminSettlements from "./pages/AdminSettlements";
import AdminSettings from "./pages/AdminSettings";
import TrackShipment from "./pages/TrackShipment";
import TrackOrderPage from "./pages/TrackOrderPage";
import Storefront from "./pages/Storefront";
import ProductPage from "./pages/ProductPage";
import ReviewOrderPage from "./pages/ReviewOrderPage";
import NotFound from "./pages/NotFound";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/track" element={<TrackOrderPage />} />
          <Route path="/track-shipment" element={<TrackShipment />} />
          <Route path="/track-shipment/:trackingId" element={<TrackShipment />} />

          {/* Public customer review page (no auth) */}
          <Route path="/review/:order_id" element={<ReviewOrderPage />} />

          {/* Public storefront & product pages */}
          <Route path="/store/:merchantId" element={<Storefront />} />
          <Route path="/product/:slug" element={<ProductPage />} />

          {/* Protected: Merchant — unified sidebar layout */}
          <Route path="/merchant" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantDashboard />
            </AuthGuard>
          } />
          <Route path="/merchant/dashboard" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantDashboard />
            </AuthGuard>
          } />
          <Route path="/merchant/orders" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantOrdersPage />
            </AuthGuard>
          } />
          <Route path="/merchant/wallet" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantWalletPage />
            </AuthGuard>
          } />
          <Route path="/merchant/products" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantProductsPage />
            </AuthGuard>
          } />
          <Route path="/merchant/settings" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantSettingsPage />
            </AuthGuard>
          } />
          <Route path="/topup" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <TopUp />
            </AuthGuard>
          } />

          {/* Protected: Courier company (vendor role) — legacy /vendor removed */}
          <Route path="/courier/orders" element={
            <AuthGuard allowedRoles={["vendor"]}>
              <CourierOrders />
            </AuthGuard>
          } />
          <Route path="/courier/wallet" element={
            <AuthGuard allowedRoles={["vendor"]}>
              <CourierWallet />
            </AuthGuard>
          } />

          {/* Protected: Admin */}
          <Route path="/admin" element={
            <AuthGuard allowedRoles={["admin"]}>
              <AdminLogistics />
            </AuthGuard>
          } />
          <Route path="/admin/districts" element={<Navigate to="/admin?tab=districts" replace />} />
          <Route path="/admin/branches" element={<Navigate to="/admin?tab=branches" replace />} />
          <Route path="/admin/couriers" element={<Navigate to="/admin?tab=couriers" replace />} />
          <Route path="/admin/merchants" element={<Navigate to="/admin?tab=merchants" replace />} />
          <Route path="/admin/settlements" element={
            <AuthGuard allowedRoles={["admin"]}>
              <AdminSettlements />
            </AuthGuard>
          } />
          <Route path="/admin/settings" element={
            <AuthGuard allowedRoles={["admin"]}>
              <AdminSettings />
            </AuthGuard>
          } />

          {/* Legacy redirects */}
          <Route path="/dashboard" element={<Login />} />
          <Route path="/admin-logistics" element={
            <AuthGuard allowedRoles={["admin"]}>
              <AdminLogistics />
            </AuthGuard>
          } />
          <Route path="/products" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantProductsPage />
            </AuthGuard>
          } />
          <Route path="/orders" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantOrdersPage />
            </AuthGuard>
          } />
          <Route path="/wallet" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantWalletPage />
            </AuthGuard>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
