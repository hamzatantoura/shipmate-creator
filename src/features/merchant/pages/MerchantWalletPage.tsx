import MerchantLayout from "@/features/merchant/components/MerchantLayout";
import ErrorBoundary from "@/shared/components/feedback/ErrorBoundary";
import MerchantWallet from "@/features/merchant/components/MerchantWallet";
import MerchantVerificationGate from "@/features/merchant/components/MerchantVerificationGate";

export default function MerchantWalletPage() {
  return (
    <MerchantLayout title="المحفظة" subtitle="رصيدك وسجل حركات المحفظة">
      <MerchantVerificationGate>
        <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المحفظة">
          <MerchantWallet />
        </ErrorBoundary>
      </MerchantVerificationGate>
    </MerchantLayout>
  );
}