import MerchantLayout from "@/components/merchant/MerchantLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import MerchantShippingSettings from "@/components/merchant/MerchantShippingSettings";
import MerchantKycCard from "@/components/merchant/MerchantKycCard";

export default function MerchantSettingsPage() {
  return (
    <MerchantLayout title="الإعدادات" subtitle="بيانات المتجر وسياسات الشحن">
      <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الإعدادات">
        <div className="space-y-6 max-w-lg">
          <MerchantShippingSettings />
          <MerchantKycCard />
        </div>
      </ErrorBoundary>
    </MerchantLayout>
  );
}