import AppHeader from "@/components/AppHeader";
import AdminDistrictsManagement from "@/components/admin/AdminDistrictsManagement";

export default function AdminDistricts() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <AdminDistrictsManagement />
      </main>
    </div>
  );
}
