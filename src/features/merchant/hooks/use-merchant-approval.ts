import { useMerchantVerification } from "@/features/merchant/hooks/use-merchant-verification";

/**
 * Thin wrapper over useMerchantVerification that exposes a simple
 * "is this merchant approved to operate (create shipments, sell publicly)?"
 * boolean plus a localized lock message for action buttons.
 *
 * Source of truth: merchants.verification_status === 'verified'.
 */
export function useMerchantApproval() {
  const v = useMerchantVerification();
  const isApproved = v.verification_status === "verified";
  const lockMessage = !isApproved
    ? "متاحة بعد تفعيل الحساب من الإدارة"
    : "";
  return {
    loading: v.loading,
    isApproved,
    status: v.verification_status,
    lockMessage,
    checks: v.checks,
  };
}