import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Download, Smartphone, Apple, Monitor, Share, Plus, ArrowLeft, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import silaLogo from "@/assets/sila-logo.png";
import { toast } from "sonner";

export default function Install() {
  const { canInstall, installed, isIOS, promptInstall } = usePWAInstall();

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (ok) toast.success("تم تثبيت التطبيق بنجاح");
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={silaLogo} alt="Sila" className="h-8 w-8" />
            <span className="font-display font-bold text-xl text-primary">Sila</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> الرئيسية
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-5">
            <Download className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">حمّل تطبيق صلة</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            ثبّت منصة صلة على جهازك للوصول السريع كأنه تطبيق أصلي — يعمل دون اتصال ويفتح بضغطة واحدة من شاشتك الرئيسية.
          </p>
        </div>

        {installed && (
          <Card className="mb-8 border-primary/30 bg-primary/5">
            <CardContent className="p-5 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold">التطبيق مثبّت بالفعل على هذا الجهاز</div>
                <div className="text-sm text-muted-foreground">يمكنك فتحه من شاشتك الرئيسية مباشرة.</div>
              </div>
            </CardContent>
          </Card>
        )}

        {canInstall && !installed && (
          <Card className="mb-8 border-primary/40 bg-gradient-to-bl from-primary/10 to-transparent">
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <div className="font-display font-bold text-lg mb-1">جاهز للتثبيت</div>
                <div className="text-sm text-muted-foreground">متصفحك يدعم التثبيت المباشر بضغطة واحدة.</div>
              </div>
              <Button size="lg" onClick={handleInstall} className="gap-2 glow-btn">
                <Download className="h-5 w-5" /> ثبّت الآن
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {/* Android */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Android</h3>
              </div>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pr-4">
                <li>افتح الموقع في متصفح Chrome.</li>
                <li>اضغط زر القائمة <span className="font-bold">(⋮)</span> أعلى يمين الشاشة.</li>
                <li>اختر <span className="text-foreground font-medium">«تثبيت التطبيق»</span> أو «إضافة إلى الشاشة الرئيسية».</li>
                <li>أكّد التثبيت — ستظهر أيقونة صلة على شاشتك.</li>
              </ol>
            </CardContent>
          </Card>

          {/* iOS */}
          <Card className={isIOS ? "border-primary/40" : ""}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Apple className="h-5 w-5 text-primary" />
                <h3 className="font-bold">iPhone / iPad</h3>
              </div>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pr-4">
                <li>افتح الموقع في متصفح <span className="font-medium text-foreground">Safari</span> (ليس Chrome).</li>
                <li>اضغط زر المشاركة <Share className="inline h-4 w-4" /> في الأسفل.</li>
                <li>مرّر للأسفل واختر <span className="text-foreground font-medium">«إضافة إلى الشاشة الرئيسية»</span> <Plus className="inline h-4 w-4" />.</li>
                <li>اضغط «إضافة» في الأعلى.</li>
              </ol>
            </CardContent>
          </Card>

          {/* Desktop */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="h-5 w-5 text-primary" />
                <h3 className="font-bold">الكمبيوتر</h3>
              </div>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pr-4">
                <li>افتح الموقع في Chrome أو Edge.</li>
                <li>ابحث عن أيقونة التثبيت <Download className="inline h-4 w-4" /> في يمين شريط العنوان.</li>
                <li>اضغطها واختر <span className="text-foreground font-medium">«تثبيت»</span>.</li>
                <li>سيُفتح التطبيق في نافذة مستقلة.</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          ملاحظة: ميزة التثبيت تعمل فقط على الموقع المنشور (sila-sy.com) عبر اتصال HTTPS، ولا تظهر داخل معاينة المحرر.
        </div>
      </main>
    </div>
  );
}