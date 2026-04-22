import MerchantLayout from "@/components/merchant/MerchantLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import MerchantWallet from "@/components/merchant/MerchantWallet";
import MerchantVerificationGate from "@/components/merchant/MerchantVerificationGate";

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