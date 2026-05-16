import MerchantLayout from "@/features/merchant/components/MerchantLayout";
import ErrorBoundary from "@/shared/components/feedback/ErrorBoundary";
import MerchantProducts from "@/features/merchant/components/MerchantProducts";
import MerchantBrandingForm from "@/features/merchant/components/MerchantBrandingForm";

export default function MerchantProductsPage() {
  return (
    <MerchantLayout title="المنتجات" subtitle="إدارة منتجات متجرك">
      <ErrorBoundary fallbackMessage="حدث خطأ في تحميل المنتجات">
        <div className="space-y-6">
          <MerchantBrandingForm />
          <MerchantProducts />
        </div>
      </ErrorBoundary>
    </MerchantLayout>
  );
}