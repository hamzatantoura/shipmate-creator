import AppHeader from "@/components/AppHeader";
import CourierWalletPanel from "@/components/courier/CourierWalletPanel";

export default function CourierWallet() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <CourierWalletPanel />
      </main>
    </div>
  );
}
