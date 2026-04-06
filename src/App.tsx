import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import MerchantPortal from "./pages/MerchantPortal.tsx";
import TopUp from "./pages/TopUp.tsx";
import AdminLogistics from "./pages/AdminLogistics.tsx";
import TrackShipment from "./pages/TrackShipment.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/merchant" element={<MerchantPortal />} />
          <Route path="/topup" element={<TopUp />} />
          {/* Carrier merged into admin */}
          <Route path="/admin-logistics" element={<AdminLogistics />} />
          <Route path="/track" element={<TrackShipment />} />
          {/* Legacy redirects */}
          <Route path="/dashboard" element={<MerchantPortal />} />
          <Route path="/products" element={<MerchantPortal />} />
          <Route path="/orders" element={<MerchantPortal />} />
          <Route path="/wallet" element={<MerchantPortal />} />
          <Route path="/admin/payouts" element={<AdminLogistics />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
