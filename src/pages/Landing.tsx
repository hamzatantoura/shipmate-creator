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
            <Truck className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-xl text-foreground tracking-tight">ShipDash</span>
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
        <div className="max-w-6xl mx-auto px-4 py-24 md:py-36 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Zap className="h-3.5 w-3.5" />
              منصة متكاملة للتجارة والشحن
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              متجرك الإلكتروني
              <br />
              <span className="text-primary">+ شحن متكامل</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
              أنشئ متجرك، أدِر منتجاتك، واشحن طلباتك عبر أفضل شركات الشحن في سوريا — كل ذلك من منصة واحدة.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2 text-base px-8 h-12">
                  ابدأ الآن مجاناً
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-base px-8 h-12">
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
              <Card key={f.title} className="bg-card border-border hover:border-primary/30 transition-colors group">
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
          <p className="text-muted-foreground text-lg mb-8">انضم إلى مئات التجار الذين يستخدمون ShipDash لإدارة تجارتهم</p>
          <Link to="/dashboard">
            <Button size="lg" className="gap-2 text-base px-10 h-12">
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
            <Truck className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">ShipDash</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} ShipDash — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
