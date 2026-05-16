import MerchantLayout from "@/features/merchant/components/MerchantLayout";
import ErrorBoundary from "@/shared/components/feedback/ErrorBoundary";
import MerchantShippingSettings from "@/features/merchant/components/MerchantShippingSettings";
import MerchantKycCard from "@/features/merchant/components/MerchantKycCard";
import MerchantSecurityCard from "@/features/merchant/components/MerchantSecurityCard";
import MerchantBrandingForm from "@/features/merchant/components/MerchantBrandingForm";
import MerchantBranchesManager from "@/features/merchant/components/MerchantBranchesManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MerchantSettingsPage() {
  return (
    <MerchantLayout title="الإعدادات" subtitle="بيانات المتجر وسياسات الشحن">
      <ErrorBoundary fallbackMessage="حدث خطأ في تحميل الإعدادات">
        <Tabs defaultValue="store" className="max-w-2xl">
          <TabsList className="mb-4">
            <TabsTrigger value="store">هوية المتجر</TabsTrigger>
            <TabsTrigger value="branches">الفروع</TabsTrigger>
            <TabsTrigger value="shipping">الشحن</TabsTrigger>
            <TabsTrigger value="account">الحساب</TabsTrigger>
          </TabsList>

          <TabsContent value="store" className="space-y-6">
            <MerchantBrandingForm />
          </TabsContent>

          <TabsContent value="branches" className="space-y-6">
            <MerchantBranchesManager />
          </TabsContent>

          <TabsContent value="shipping" className="space-y-6">
            <MerchantShippingSettings />
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <MerchantKycCard />
            <div id="security">
              <MerchantSecurityCard />
            </div>
          </TabsContent>
        </Tabs>
      </ErrorBoundary>
    </MerchantLayout>
  );
}