import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wallet, Clock, TrendingUp, ShoppingCart, RotateCcw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import silaLogo from "@/assets/sila-logo.png";
import { Link } from "react-router-dom";

const fmt = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";

export default function MerchantDashboard() {
  const { profile, signOut } = useAuth();

  // Dummy values
  const availableBalance = 1_250_000;
  const onHoldBalance = 480_000;
  const pendingBalance = 920_000;
  const newOrdersCount = 12;
  const returnsCount = 2;

  // Simulated lock state
  const isLocked = true;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <MerchantSidebar />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Link to="/" className="flex items-center gap-2">
                <img src={silaLogo} alt="Sila" className="h-7 w-7" />
                <span className="font-display font-bold text-lg text-primary">صلة</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {profile?.store_name && (
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {profile.store_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                خروج
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">الرئيسية</h1>
              <p className="text-sm text-muted-foreground mt-1">
                مرحباً بك في لوحة تحكم التاجر
              </p>
            </div>

            {/* Lock Banner */}
            {isLocked && (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <ShieldAlert className="h-5 w-5" />
                <AlertTitle className="font-bold">حساب قيد المراجعة الأمنية</AlertTitle>
                <AlertDescription>
                  حسابك قيد المراجعة الأمنية. لا يمكنك استقبال طلبات جديدة حالياً.
                </AlertDescription>
              </Alert>
            )}

            {/* 3-Tier Wallet */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">المحفظة المالية</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Available */}
                <Card className="border-r-4 border-r-emerald-500 bg-gradient-to-bl from-emerald-500/10 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        الرصيد المتاح
                      </CardTitle>
                      <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-500" dir="ltr">
                      <span dir="rtl">{fmt(availableBalance)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">جاهز للسحب الآن</p>
                  </CardContent>
                </Card>

                {/* On Hold */}
                <Card className="border-r-4 border-r-amber-500 bg-gradient-to-bl from-amber-500/10 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        بانتظار التحويل
                      </CardTitle>
                      <div className="h-9 w-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-amber-500" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-500">
                      {fmt(onHoldBalance)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      شحنات مُوصَّلة بانتظار التحاسب
                    </p>
                  </CardContent>
                </Card>

                {/* Pending */}
                <Card className="border-r-4 border-r-sky-500 bg-gradient-to-bl from-sky-500/10 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        الرصيد المتوقع
                      </CardTitle>
                      <div className="h-9 w-9 rounded-full bg-sky-500/20 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-sky-500" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-sky-500">
                      {fmt(pendingBalance)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      طلبات قيد التوصيل
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Quick Stats */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">إحصائيات سريعة</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">الطلبات الجديدة</p>
                      <p className="text-3xl font-bold text-foreground">{newOrdersCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-destructive/15 flex items-center justify-center">
                      <RotateCcw className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">المرتجعات</p>
                      <p className="text-3xl font-bold text-foreground">{returnsCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
