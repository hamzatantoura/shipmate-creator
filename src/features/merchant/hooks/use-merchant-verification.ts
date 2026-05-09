import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";

export interface VerificationState {
  verification_status: "pending_verification" | "pending_admin_approval" | "verified" | "rejected";
  phone_verified: boolean;
  email_confirmed: boolean;
  id_image_url: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  verification_video_url: string | null;
  logo_url: string | null;
  warehouse_address: string | null;
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
  id_front_url: null,
  id_back_url: null,
  verification_video_url: null,
  logo_url: null,
  warehouse_address: null,
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

  const fetchVerification = useCallback(async () => {
    if (!user) return;

    // Source of truth: Supabase Auth email_confirmed_at
    const { data: sessionData } = await supabase.auth.getSession();
    const freshUser = sessionData?.session?.user;
    const emailConfirmed = !!(freshUser?.email_confirmed_at || user.email_confirmed_at);

    const { data: merchant } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const m = merchant as any;
    if (m) {
      // Sync email_confirmed from auth to merchants table
      if (emailConfirmed && !m.email_confirmed) {
        await supabase
          .from("merchants")
          .update({ email_confirmed: true } as any)
          .eq("user_id", user.id);
      }

      // Auto-transition: once required store data is completed, move to pending_admin_approval
      const allCriticalPassed =
        !!m.store_name?.trim() &&
        !!m.contact_person?.trim() &&
        !!m.city?.trim() &&
        !!m.shipping_policy &&
        !!m.id_front_url &&
        !!m.id_back_url &&
        !!m.verification_video_url &&
        !!m.logo_url &&
        !!m.warehouse_address?.trim();
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
        id_front_url: m.id_front_url || null,
        id_back_url: m.id_back_url || null,
        verification_video_url: m.verification_video_url || null,
        logo_url: m.logo_url || null,
        warehouse_address: m.warehouse_address || null,
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
        { key: "id_front_url", label: "صورة الهوية – أمامي", ok: !!m.id_front_url },
        { key: "id_back_url", label: "صورة الهوية – خلفي", ok: !!m.id_back_url },
        { key: "verification_video_url", label: "فيديو التحقق (5 ثوانٍ)", ok: !!m.verification_video_url },
        { key: "logo_url", label: "شعار المتجر", ok: !!m.logo_url },
        { key: "warehouse_address", label: "عنوان المستودع", ok: !!m.warehouse_address?.trim() },
        { key: "shipping_policy", label: "سياسة الشحن", ok: !!m.shipping_policy },
      ];
      setChecks(c);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchVerification();
  }, [user, fetchVerification]);

  // Auto-refresh when user returns to tab (after clicking email confirmation link)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        // Refresh auth session to get updated email_confirmed_at
        supabase.auth.getSession().then(() => {
          fetchVerification();
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, fetchVerification]);

  const isVerified = state.verification_status === "verified";
  const allChecksPassed = checks.length > 0 && checks.every((c) => c.ok);
  const canOperate = isVerified;
  const missingChecks = checks.filter((c) => !c.ok);

  // Critical checks that block product/shipment access
  const criticalBlocked =
    !state.email_confirmed ||
    !state.id_front_url ||
    !state.id_back_url ||
    !state.verification_video_url ||
    !state.logo_url;

  return {
    ...state,
    loading,
    checks,
    missingChecks,
    isVerified,
    allChecksPassed,
    canOperate,
    criticalBlocked,
    refetch: () => {
      setLoading(true);
      fetchVerification();
    },
  };
}
