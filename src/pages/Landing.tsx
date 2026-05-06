import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Package, Truck, Store, Wallet, ShieldCheck, Zap, ArrowLeft,
  BarChart3, Globe, Link2, Users, CreditCard, LayoutDashboard, Download
} from "lucide-react";
import heroIllustration from "@/assets/hero-illustration.png";
import silaLogo from "@/assets/sila-logo.png";

const FEATURES = [
  { icon: Store, title: "أنشئ متجرك الرقمي", desc: "أطلق متجرك الإلكتروني في دقائق مع إدارة كاملة للمنتجات والمخزون" },
  { icon: Link2, title: "اربط شركات الشحن", desc: "اختر من بين عدة شركات شحن معتمدة واربطها بمتجرك بضغطة واحدة" },
  { icon: LayoutDashboard, title: "لوحة تحكم موحّدة", desc: "تتبّع جميع شحناتك من مختلف الشركات في مكان واحد" },
  { icon: Wallet, title: "سجل مالي متكامل", desc: "اعرض مبيعاتك، مبالغ COD المحصّلة، ورسوم المنصة بشفافية كاملة" },
  { icon: Package, title: "إدارة الطلبات", desc: "من استلام الطلب إلى التسليم — تحكّم بكل مرحلة باحترافية" },
];

const STATS = [
  { value: "+500", label: "تاجر نشط" },
  { value: "+15", label: "شركة شحن" },
  { value: "+50K", label: "شحنة شهرياً" },
  { value: "14", label: "محافظة مغطاة" },
];

const STEPS = [
  { num: "01", title: "سجّل متجرك", desc: "أنشئ حسابك كتاجر واملأ بيانات متجرك في دقيقتين" },
  { num: "02", title: "أضف منتجاتك", desc: "ارفع منتجاتك واستقبل الطلبات من عملائك" },
  { num: "03", title: "اختر شركة الشحن", desc: "قارن الأسعار والخدمات واختر الشريك المناسب لكل شحنة" },
  { num: "04", title: "تتبّع وحصّل", desc: "تابع شحناتك لحظة بلحظة واستلم أرباحك تلقائياً" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={silaLogo} alt="Sila" className="h-8 w-8" />
            <span className="font-display font-bold text-xl text-primary tracking-tight">Sila</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/track">
              <Button variant="ghost" size="sm" className="text-sm">تتبع شحنة</Button>
            </Link>
            <Link to="/install">
              <Button variant="outline" size="sm" className="text-sm gap-1.5">
                <Download className="h-4 w-4" />
                حمّل التطبيق
              </Button>
            </Link>
            <Link to="/login">
              <Button className="gap-2 glow-btn">
                <ArrowLeft className="h-4 w-4" />
                سجّل دخولك
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.04] via-background to-background">
        <div className="absolute inset-0 opacity-[0.025]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(217 91% 60%)" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-5">
                <Zap className="h-3.5 w-3.5" />
                بوابة التجارة الرقمية والشحن في سوريا
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-display font-bold text-foreground leading-snug mb-4">
                متجرك + شحنك
                <br />
                <span className="text-primary">في منصة واحدة</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-7 max-w-md">
                صلة تربط تجار سوريا بشركات الشحن الموثوقة. أنشئ متجرك، استقبل الطلبات، واشحن بذكاء — كل ذلك من لوحة تحكم واحدة.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link to="/signup">
                  <Button size="lg" className="gap-2 text-base px-7 h-12 font-semibold glow-btn">
                    ابدأ مجاناً
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/track">
                  <Button size="lg" variant="outline" className="text-base px-7 h-12 border-primary/30 text-foreground hover:bg-primary/5">
                    تتبّع شحنة
                  </Button>
                </Link>
              </div>
            </div>
            <div className="order-1 md:order-2 flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl scale-90" />
                <img
                  src={heroIllustration}
                  alt="منصة صلة — بوابة التجارة الرقمية والشحن"
                  className="relative w-full h-auto drop-shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-2xl md:text-3xl font-display font-bold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
              كل ما يحتاجه التاجر السوري
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
              بنية تحتية برمجية متكاملة تمكّنك من البيع والشحن باحترافية
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all group">
                <CardContent className="p-6">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
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

      {/* How it Works */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
              كيف تعمل صلة؟
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">أربع خطوات فقط لبدء تجارتك الرقمية</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                <div className="text-5xl font-display font-bold text-primary/10 mb-3">{step.num}</div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -left-3 w-6 h-px bg-primary/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Shipping Companies */}
      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">
            جاهز لتحويل تجارتك إلى الرقمية؟
          </h2>
          <p className="text-muted-foreground text-base md:text-lg mb-8">
            انضم لمئات التجار وشركات الشحن على صلة — ابدأ مجاناً بدون التزام
          </p>
          <Link to="/signup">
            <Button size="lg" className="gap-2 text-base px-10 h-12 font-semibold glow-btn">
              أنشئ متجرك الآن
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src={silaLogo} alt="Sila" className="h-7 w-7" />
                <span className="font-display font-bold text-lg text-primary">Sila</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                بوابة التجارة الرقمية والشحن المتكامل في سوريا. نربط التجار بشركات الشحن الموثوقة.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-foreground mb-3">روابط سريعة</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/track" className="hover:text-primary transition-colors">تتبع شحنة</Link></li>
                <li><Link to="/signup" className="hover:text-primary transition-colors">تسجيل تاجر</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">تسجيل دخول</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-foreground mb-3">تواصل معنا</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>info@sila-sy.com</li>
                <li>دمشق، سوريا</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Sila — جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
