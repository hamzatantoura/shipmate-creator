import MerchantLayout from "@/features/merchant/components/MerchantLayout";
import ErrorBoundary from "@/shared/components/feedback/ErrorBoundary";
import MerchantShippingSettings from "@/features/merchant/components/MerchantShippingSettings";
import MerchantKycCard from "@/features/merchant/components/MerchantKycCard";

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