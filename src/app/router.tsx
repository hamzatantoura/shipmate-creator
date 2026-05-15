import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "@/features/auth/components/AuthGuard";
import { useAuth } from "@/features/auth/hooks/use-auth";

// Public / app-level pages
import Landing from "@/app/pages/Landing";
import NotFound from "@/app/pages/NotFound";
import Install from "@/app/pages/Install";

// Auth feature
import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";
import ForgotPassword from "@/features/auth/pages/ForgotPassword";
import ResetPassword from "@/features/auth/pages/ResetPassword";
import VerifyEmail from "@/features/auth/pages/VerifyEmail";
import CompleteProfile from "@/features/auth/pages/CompleteProfile";

// Merchant feature
import MerchantDashboard from "@/features/merchant/pages/MerchantDashboard";
import MerchantOrdersPage from "@/features/merchant/pages/MerchantOrdersPage";
import MerchantArchivePage from "@/features/merchant/pages/MerchantArchivePage";
import MerchantWalletPage from "@/features/merchant/pages/MerchantWalletPage";
import MerchantProductsPage from "@/features/merchant/pages/MerchantProductsPage";
import MerchantSettingsPage from "@/features/merchant/pages/MerchantSettingsPage";
import TopUp from "@/features/merchant/pages/TopUp";

// Courier feature
import CourierDashboard from "@/features/courier/pages/CourierDashboard";
import CourierOrders from "@/features/courier/pages/CourierOrders";
import CourierWallet from "@/features/courier/pages/CourierWallet";

// Admin feature
import AdminLogistics from "@/features/admin/pages/AdminLogistics";
import AdminSettlements from "@/features/admin/pages/AdminSettlements";
import AdminSettings from "@/features/admin/pages/AdminSettings";
import AdminCoverageMap from "@/features/admin/pages/AdminCoverageMap";
import AdminDistrictsMap from "@/features/admin/pages/AdminDistrictsMap";

// Storefront & tracking
import Storefront from "@/features/storefront/pages/Storefront";
import ProductPage from "@/features/storefront/pages/ProductPage";
import ReviewOrderPage from "@/features/storefront/pages/ReviewOrderPage";
import TrackOrderPage from "@/features/tracking/pages/TrackOrderPage";
import TrackShipment from "@/features/tracking/pages/TrackShipment";

/**
 * Single source of truth for application routes. Grouped by access tier:
 * public → merchant → courier → admin → legacy redirects.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/track" element={<TrackOrderPage />} />
        <Route path="/track-shipment" element={<TrackShipment />} />
        <Route path="/track-shipment/:trackingId" element={<TrackShipment />} />
        <Route path="/install" element={<Install />} />
        <Route path="/review/:order_id" element={<ReviewOrderPage />} />
        <Route path="/store/:merchantId" element={<Storefront />} />
        <Route path="/product/:slug" element={<ProductPage />} />

        {/* Merchant */}
        <Route path="/merchant" element={<AuthGuard allowedRoles={["merchant"]}><MerchantDashboard /></AuthGuard>} />
        <Route path="/merchant/dashboard" element={<AuthGuard allowedRoles={["merchant"]}><MerchantDashboard /></AuthGuard>} />
        <Route path="/merchant/orders" element={<AuthGuard allowedRoles={["merchant"]}><MerchantOrdersPage /></AuthGuard>} />
        <Route path="/merchant/archive" element={<AuthGuard allowedRoles={["merchant"]}><MerchantArchivePage /></AuthGuard>} />
        <Route path="/merchant/wallet" element={<AuthGuard allowedRoles={["merchant"]}><MerchantWalletPage /></AuthGuard>} />
        <Route path="/merchant/products" element={<AuthGuard allowedRoles={["merchant"]}><MerchantProductsPage /></AuthGuard>} />
        <Route path="/merchant/settings" element={<AuthGuard allowedRoles={["merchant"]}><MerchantSettingsPage /></AuthGuard>} />
        <Route path="/topup" element={<AuthGuard allowedRoles={["merchant"]}><TopUp /></AuthGuard>} />

        {/* Courier (vendor role) */}
        <Route path="/courier" element={<AuthGuard allowedRoles={["vendor"]}><CourierDashboard /></AuthGuard>} />
        <Route path="/courier/dashboard" element={<AuthGuard allowedRoles={["vendor"]}><CourierDashboard /></AuthGuard>} />
        <Route path="/courier/orders" element={<AuthGuard allowedRoles={["vendor"]}><CourierOrders /></AuthGuard>} />
        <Route path="/courier/wallet" element={<AuthGuard allowedRoles={["vendor"]}><CourierWallet /></AuthGuard>} />

        {/* Admin */}
        <Route path="/admin" element={<AuthGuard allowedRoles={["admin"]}><AdminLogistics /></AuthGuard>} />
        <Route path="/admin/districts" element={<Navigate to="/admin?tab=districts" replace />} />
        <Route path="/admin/branches" element={<Navigate to="/admin?tab=branches" replace />} />
        <Route path="/admin/couriers" element={<Navigate to="/admin?tab=couriers" replace />} />
        <Route path="/admin/merchants" element={<Navigate to="/admin?tab=merchants" replace />} />
        <Route path="/admin/settlements" element={<AuthGuard allowedRoles={["admin"]}><AdminSettlements /></AuthGuard>} />
        <Route path="/admin/settings" element={<AuthGuard allowedRoles={["admin"]}><AdminSettings /></AuthGuard>} />
        <Route path="/admin/coverage-map" element={<AuthGuard allowedRoles={["admin"]}><AdminCoverageMap /></AuthGuard>} />
        <Route path="/admin/districts-map" element={<AuthGuard allowedRoles={["admin"]}><AdminDistrictsMap /></AuthGuard>} />

        {/* Legacy redirects */}
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/admin-logistics" element={<AuthGuard allowedRoles={["admin"]}><AdminLogistics /></AuthGuard>} />
        <Route path="/products" element={<Navigate to="/merchant/products" replace />} />
        <Route path="/orders" element={<Navigate to="/merchant/orders" replace />} />
        <Route path="/wallet" element={<Navigate to="/merchant/wallet" replace />} />
        <Route path="/pricing" element={<Navigate to="/signup" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * `/dashboard` is a generic alias — route the user to the dashboard for
 * their role, or to /login when not authenticated.
 */
function DashboardRedirect() {
  const { user, role, profile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.needs_onboarding) return <Navigate to="/complete-profile" replace />;
  const map = { admin: "/admin", merchant: "/merchant", vendor: "/courier/orders" } as const;
  return <Navigate to={role ? map[role] : "/login"} replace />;
}