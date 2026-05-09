import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import "@/i18n/config";
import { useLanguage } from "@/i18n/use-language";

const queryClient = new QueryClient();

/**
 * Applies <html lang/dir> based on the persisted i18n language.
 * Rendered once near the top of the tree.
 */
function I18nDirectionSync({ children }: { children: ReactNode }) {
  useLanguage();
  return <>{children}</>;
}

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
          <I18nDirectionSync>{children}</I18nDirectionSync>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}