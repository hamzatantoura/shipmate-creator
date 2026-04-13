import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface VerificationState {
  verification_status: "pending_verification" | "pending_admin_approval" | "verified" | "rejected";
  phone_verified: boolean;
  email_confirmed: boolean;
  id_image_url: string | null;
  store_name: string;
  contact_person: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  shipping_policy: string;
}

interface VerificationCheck {
  key: string;
  label: string;
  ok: boolean;
}

const DEFAULT_STATE: VerificationState = {
  verification_status: "pending_verification",
  phone_verified: false,
  email_confirmed: false,
  id_image_url: null,
  store_name: "",
  contact_person: null,
  phone: null,
  whatsapp_number: null,
  city: null,
  shipping_policy: "customer_pays",
};

export function useMerchantVerification() {
  const { user } = useAuth();
  const [state, setState] = useState<VerificationState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<VerificationCheck[]>([]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      // Check email confirmation from merchants table (set by verify-email edge function)
      const emailConfirmedFromAuth = !!user.email_confirmed_at;

      const { data: merchant } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const m = merchant as any;
      if (m) {
        const emailConfirmed = m.email_confirmed || emailConfirmedFromAuth;
        // Sync email_confirmed from auth to merchants table
        if (emailConfirmedFromAuth && !m.email_confirmed) {
          await supabase
            .from("merchants")
            .update({ email_confirmed: true } as any)
            .eq("user_id", user.id);
        }

        // Auto-transition: once required store data is completed, move to pending_admin_approval
        const allCriticalPassed = !!m.store_name?.trim() && !!m.contact_person?.trim() && !!m.city?.trim() && !!m.shipping_policy;
        let currentStatus = m.verification_status || "pending_verification";
        if (allCriticalPassed && currentStatus === "pending_verification") {
          await supabase
            .from("merchants")
            .update({ verification_status: "pending_admin_approval" } as any)
            .eq("user_id", user.id);
          currentStatus = "pending_admin_approval";
        }

        const vs: VerificationState = {
          verification_status: currentStatus,
          phone_verified: m.phone_verified || false,
          email_confirmed: emailConfirmed,
          id_image_url: m.id_image_url || null,
          store_name: m.store_name || "",
          contact_person: m.contact_person,
          phone: m.phone,
          whatsapp_number: m.whatsapp_number,
          city: m.city,
          shipping_policy: m.shipping_policy || "customer_pays",
        };
        setState(vs);

        const c: VerificationCheck[] = [
          { key: "email_confirmed", label: "تأكيد البريد الإلكتروني", ok: emailConfirmed },
          { key: "store_name", label: "اسم المتجر", ok: !!m.store_name?.trim() },
          { key: "contact_person", label: "اسم التاجر", ok: !!m.contact_person?.trim() },
          { key: "city", label: "المحافظة", ok: !!m.city?.trim() },
          { key: "shipping_policy", label: "سياسة الشحن", ok: !!m.shipping_policy },
        ];
        setChecks(c);
      }
      setLoading(false);
    })();
  }, [user]);

  const isVerified = state.verification_status === "verified";
  const allChecksPassed = checks.length > 0 && checks.every((c) => c.ok);
  const canOperate = isVerified;
  const missingChecks = checks.filter((c) => !c.ok);

  return { ...state, loading, checks, missingChecks, isVerified, allChecksPassed, canOperate, refetch: () => {
    // Force re-fetch by toggling loading
    setLoading(true);
    if (user) {
      (async () => {
        const emailConfirmed = !!user.email_confirmed_at;
        const { data: merchant } = await supabase
          .from("merchants")
          .select("*")
          .eq("user_id", user.id)
          .single();
        const m = merchant as any;
        if (m) {
          // Sync email_confirmed
          if (emailConfirmed && !m.email_confirmed) {
            await supabase.from("merchants").update({ email_confirmed: true } as any).eq("user_id", user.id);
          }
          // Auto-transition
          const allCriticalPassed = !!m.store_name?.trim() && !!m.contact_person?.trim() && !!m.city?.trim() && !!m.shipping_policy;
          let currentStatus = m.verification_status || "pending_verification";
          if (allCriticalPassed && currentStatus === "pending_verification") {
            await supabase.from("merchants").update({ verification_status: "pending_admin_approval" } as any).eq("user_id", user.id);
            currentStatus = "pending_admin_approval";
          }
          setState({
            verification_status: currentStatus,
            phone_verified: m.phone_verified || false,
            email_confirmed: emailConfirmed,
            id_image_url: m.id_image_url || null,
            store_name: m.store_name || "",
            contact_person: m.contact_person,
            phone: m.phone,
            whatsapp_number: m.whatsapp_number,
            city: m.city,
            shipping_policy: m.shipping_policy || "customer_pays",
          });
          setChecks([
            { key: "email_confirmed", label: "تأكيد البريد الإلكتروني", ok: emailConfirmed },
            { key: "store_name", label: "اسم المتجر", ok: !!m.store_name?.trim() },
            { key: "contact_person", label: "اسم التاجر", ok: !!m.contact_person?.trim() },
            { key: "city", label: "المحافظة", ok: !!m.city?.trim() },
            { key: "shipping_policy", label: "سياسة الشحن", ok: !!m.shipping_policy },
          ]);
        }
        setLoading(false);
      })();
    }
  }};
}
