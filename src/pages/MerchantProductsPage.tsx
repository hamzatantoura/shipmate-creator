import MerchantLayout from "@/components/merchant/MerchantLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import MerchantProducts from "@/components/merchant/MerchantProducts";
import MerchantVerificationGate from "@/components/merchant/MerchantVerificationGate";

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