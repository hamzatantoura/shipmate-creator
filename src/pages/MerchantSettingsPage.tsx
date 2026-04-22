import MerchantLayout from "@/components/merchant/MerchantLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import MerchantShippingSettings from "@/components/merchant/MerchantShippingSettings";

export default function MerchantSettingsPage() {
  return (
    <MerchantLayout title="الإعدادات" subtitle="بيانات المتجر وسياسات الشحن">
      <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الإعدادات">
        <MerchantShippingSettings />
      </ErrorBoundary>
    </MerchantLayout>
  );
}