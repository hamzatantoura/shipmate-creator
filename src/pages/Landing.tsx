import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Package, Truck, Store, Wallet, ShieldCheck, Zap, ArrowLeft } from "lucide-react";

const FEATURES = [
  { icon: Store, title: "متجرك الإلكتروني", desc: "أنشئ متجرك في دقائق وابدأ ببيع منتجاتك أونلاين بسهولة تامة" },
  { icon: Truck, title: "ربط مباشر مع شركات الشحن", desc: "اربط متجرك مع عدة شركات شحن واختر الأنسب لكل طلب" },
  { icon: Wallet, title: "محفظة ذكية", desc: "تتبّع أرباحك ومصاريف الشحن والعمولات في مكان واحد" },
  { icon: Package, title: "إدارة الطلبات", desc: "من الطلب إلى التسليم، تتبّع كل شحنة بالتفصيل" },
  { icon: ShieldCheck, title: "دفع عند الاستلام", desc: "ادعم عملاءك بخيار COD مع تسوية مالية تلقائية" },
  { icon: Zap, title: "بطاقات شحن فورية", desc: "اطبع بطاقة شحن احترافية مع QR Code بضغطة زر" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Nav */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display font-bold text-xl text-primary tracking-tight">Sila</span>
          </div>
          <Link to="/dashboard">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              ادخل للوحة التحكم
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Radial gradient for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(217_33%_16%)_0%,_hsl(222_47%_11%)_70%,_hsl(222_47%_8%)_100%)]" />
        {/* Network grid + nodes */}
        <div className="absolute inset-0">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="hsl(187 100% 50%)" strokeWidth="0.4" opacity="0.06" />
              </pattern>
              <radialGradient id="gridFade" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <mask id="gridMask"><rect width="100%" height="100%" fill="url(#gridFade)" /></mask>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
            {/* Glowing nodes */}
            <circle cx="18%" cy="28%" r="2.5" fill="hsl(187 100% 50%)" opacity="0.25" />
            <circle cx="52%" cy="55%" r="2" fill="hsl(187 100% 50%)" opacity="0.2" />
            <circle cx="78%" cy="22%" r="2" fill="hsl(187 100% 50%)" opacity="0.2" />
            <circle cx="38%" cy="78%" r="1.8" fill="hsl(187 100% 50%)" opacity="0.15" />
            <circle cx="65%" cy="70%" r="1.5" fill="hsl(187 100% 50%)" opacity="0.12" />
            {/* Connection lines */}
            <line x1="18%" y1="28%" x2="52%" y2="55%" stroke="hsl(187 100% 50%)" strokeWidth="0.5" opacity="0.08" />
            <line x1="52%" y1="55%" x2="78%" y2="22%" stroke="hsl(187 100% 50%)" strokeWidth="0.5" opacity="0.08" />
            <line x1="78%" y1="22%" x2="65%" y2="70%" stroke="hsl(187 100% 50%)" strokeWidth="0.4" opacity="0.06" />
            <line x1="38%" y1="78%" x2="52%" y2="55%" stroke="hsl(187 100% 50%)" strokeWidth="0.4" opacity="0.06" />
          </svg>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-24 md:py-36 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Zap className="h-3.5 w-3.5" />
              منصة متكاملة للتجارة والشحن في سوريا
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              صلة — منصة الوصل الذكية
              <br />
              <span className="text-primary">بين التاجر والزبون في سوريا</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
              متجرك الإلكتروني + شحن متكامل بلمسة احترافية واحدة
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2 text-base px-8 h-12 font-semibold">
                  ابدأ الآن مجاناً
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 border-primary text-foreground hover:bg-primary/10">
                شاهد العرض التوضيحي
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-card/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">كل ما تحتاجه في مكان واحد</h2>
            <p className="text-muted-foreground text-lg">أدوات قوية لإدارة تجارتك الإلكترونية والشحن</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="bg-card/80 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors group">
                <CardContent className="p-6">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">جاهز لبدء البيع أونلاين؟</h2>
          <p className="text-muted-foreground text-lg mb-8">انضم إلى مئات التجار الذين يستخدمون صلة لإدارة تجارتهم</p>
          <Link to="/dashboard">
            <Button size="lg" className="gap-2 text-base px-10 h-12 font-semibold">
              أنشئ متجرك الآن
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center">
              <Truck className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display font-semibold text-primary">Sila</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Sila — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
