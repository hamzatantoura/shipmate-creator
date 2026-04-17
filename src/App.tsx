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
import MerchantPortal from "./pages/MerchantPortal";
import MerchantDashboard from "./pages/MerchantDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import TopUp from "./pages/TopUp";
import AdminLogistics from "./pages/AdminLogistics";
import TrackShipment from "./pages/TrackShipment";
import Storefront from "./pages/Storefront";
import ProductPage from "./pages/ProductPage";
import NotFound from "./pages/NotFound";

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
          <Route path="/track" element={<TrackShipment />} />
          <Route path="/track/:trackingId" element={<TrackShipment />} />

          {/* Public storefront & product pages */}
          <Route path="/store/:merchantId" element={<Storefront />} />
          <Route path="/product/:slug" element={<ProductPage />} />

          {/* Protected: Merchant */}
          <Route path="/merchant" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantPortal />
            </AuthGuard>
          } />
          <Route path="/merchant/dashboard" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantDashboard />
            </AuthGuard>
          } />
          <Route path="/topup" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <TopUp />
            </AuthGuard>
          } />

          {/* Protected: Vendor */}
          <Route path="/vendor" element={
            <AuthGuard allowedRoles={["vendor"]}>
              <VendorDashboard />
            </AuthGuard>
          } />

          {/* Protected: Admin */}
          <Route path="/admin" element={
            <AuthGuard allowedRoles={["admin"]}>
              <AdminLogistics />
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
              <MerchantPortal />
            </AuthGuard>
          } />
          <Route path="/orders" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantPortal />
            </AuthGuard>
          } />
          <Route path="/wallet" element={
            <AuthGuard allowedRoles={["merchant"]}>
              <MerchantPortal />
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
