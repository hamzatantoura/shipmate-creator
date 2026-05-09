import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/hooks/use-auth";

const queryClient = new QueryClient();

/**
 * App-wide providers. Composes data, auth, tooltips, and toast layers
 * around the router so any feature can use them without re-wiring.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {children}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}