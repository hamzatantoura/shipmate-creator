import MerchantLayout from "@/features/merchant/components/MerchantLayout";
import ErrorBoundary from "@/shared/components/feedback/ErrorBoundary";
import MerchantProducts from "@/features/merchant/components/MerchantProducts";
import MerchantVerificationGate from "@/features/merchant/components/MerchantVerificationGate";

export default function MerchantProductsPage() {
  return (
    <MerchantLayout title="المنتجات" subtitle="إدارة منتجات متجرك">
      <MerchantVerificationGate>
        <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المنتجات">
          <MerchantProducts />
        </ErrorBoundary>
      </MerchantVerificationGate>
    </MerchantLayout>
  );
}