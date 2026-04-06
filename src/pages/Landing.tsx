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
        {/* Network grid background */}
        <div className="absolute inset-0">
          <svg className="w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(187 100% 50%)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <circle cx="20%" cy="30%" r="3" fill="hsl(187 100% 50%)" opacity="0.4" />
            <circle cx="50%" cy="60%" r="2" fill="hsl(187 100% 50%)" opacity="0.3" />
            <circle cx="75%" cy="25%" r="2.5" fill="hsl(187 100% 50%)" opacity="0.35" />
            <circle cx="40%" cy="80%" r="2" fill="hsl(187 100% 50%)" opacity="0.25" />
            <line x1="20%" y1="30%" x2="50%" y2="60%" stroke="hsl(187 100% 50%)" strokeWidth="0.5" opacity="0.15" />
            <line x1="50%" y1="60%" x2="75%" y2="25%" stroke="hsl(187 100% 50%)" strokeWidth="0.5" opacity="0.15" />
            <line x1="75%" y1="25%" x2="40%" y2="80%" stroke="hsl(187 100% 50%)" strokeWidth="0.5" opacity="0.12" />
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
