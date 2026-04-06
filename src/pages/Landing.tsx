import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Package, Truck, Store, Wallet, ShieldCheck, Zap, ArrowLeft } from "lucide-react";
import silaLogo from "@/assets/sila-logo.png";

const FEATURES = [
  { icon: Store, title: "متجرك الإلكتروني", desc: "أنشئ متجرك في دقائق وابدأ ببيع منتجاتك أونلاين بسهولة تامة", color: "text-[hsl(152,62%,35%)]", bg: "bg-[hsl(152,62%,29%,0.12)]" },
  { icon: Truck, title: "ربط مباشر مع شركات الشحن", desc: "اربط متجرك مع عدة شركات شحن واختر الأنسب لكل طلب", color: "text-[hsl(216,50%,50%)]", bg: "bg-[hsl(216,50%,45%,0.12)]" },
  { icon: Wallet, title: "محفظة ذكية", desc: "تتبّع أرباحك ومصاريف الشحن والعمولات في مكان واحد", color: "text-[hsl(152,62%,35%)]", bg: "bg-[hsl(152,62%,29%,0.12)]" },
  { icon: Package, title: "إدارة الطلبات", desc: "من الطلب إلى التسليم، تتبّع كل شحنة بالتفصيل", color: "text-[hsl(216,50%,50%)]", bg: "bg-[hsl(216,50%,45%,0.12)]" },
  { icon: ShieldCheck, title: "دفع عند الاستلام", desc: "ادعم عملاءك بخيار COD مع تسوية مالية تلقائية", color: "text-[hsl(152,62%,35%)]", bg: "bg-[hsl(152,62%,29%,0.12)]" },
  { icon: Zap, title: "بطاقات شحن فورية", desc: "اطبع بطاقة شحن احترافية مع QR Code بضغطة زر", color: "text-[hsl(216,50%,50%)]", bg: "bg-[hsl(216,50%,45%,0.12)]" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Nav */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={silaLogo} alt="Sila Logo" className="h-10 w-auto" />
          </div>
          <Link to="/login">
            <Button className="gap-2 glow-btn">
              <ArrowLeft className="h-4 w-4" />
              سجّل دخولك
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Radial gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,_hsl(152_62%_12%_/_0.15)_0%,_hsl(220_40%_7%)_50%,_hsl(216_50%_10%_/_0.1)_100%)]" />
        {/* Network grid */}
        <div className="absolute inset-0">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="hsl(152 62% 35%)" strokeWidth="0.3" opacity="0.06" />
              </pattern>
              <radialGradient id="gridFade" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <mask id="gridMask"><rect width="100%" height="100%" fill="url(#gridFade)" /></mask>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
            {/* Green nodes */}
            <circle cx="15%" cy="30%" r="3" fill="hsl(152 62% 35%)" opacity="0.3" />
            <circle cx="45%" cy="60%" r="2.5" fill="hsl(152 62% 35%)" opacity="0.2" />
            <circle cx="75%" cy="25%" r="2" fill="hsl(152 62% 35%)" opacity="0.2" />
            {/* Blue nodes */}
            <circle cx="30%" cy="70%" r="2" fill="hsl(216 50% 50%)" opacity="0.25" />
            <circle cx="60%" cy="40%" r="2.5" fill="hsl(216 50% 50%)" opacity="0.2" />
            <circle cx="85%" cy="65%" r="1.5" fill="hsl(216 50% 50%)" opacity="0.15" />
            {/* Connection lines */}
            <line x1="15%" y1="30%" x2="45%" y2="60%" stroke="hsl(152 62% 35%)" strokeWidth="0.5" opacity="0.08" />
            <line x1="45%" y1="60%" x2="75%" y2="25%" stroke="hsl(152 62% 35%)" strokeWidth="0.5" opacity="0.06" />
            <line x1="30%" y1="70%" x2="60%" y2="40%" stroke="hsl(216 50% 50%)" strokeWidth="0.5" opacity="0.08" />
            <line x1="60%" y1="40%" x2="85%" y2="65%" stroke="hsl(216 50% 50%)" strokeWidth="0.4" opacity="0.06" />
            {/* Orbital arcs like the logo */}
            <ellipse cx="50%" cy="50%" rx="25%" ry="35%" fill="none" stroke="hsl(152 62% 35%)" strokeWidth="0.4" opacity="0.05" transform="rotate(-15 50 50)" />
            <ellipse cx="50%" cy="50%" rx="30%" ry="20%" fill="none" stroke="hsl(216 50% 50%)" strokeWidth="0.4" opacity="0.04" transform="rotate(25 50 50)" />
          </svg>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-24 md:py-36 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Zap className="h-3.5 w-3.5" />
              المنصة اللوجستية التقنية السورية
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              صلة — مركز اللوجستيات الذكي
              <br />
              <span className="text-primary">يربط التاجر بشركات الشحن في سوريا</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
              منصة B2B متكاملة لإدارة الطلبات والشحن والتسويات المالية بين التجار وشركات الشحن
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link to="/signup">
                <Button size="lg" className="gap-2 text-base px-8 h-12 font-semibold glow-btn">
                  سجّل كتاجر الآن
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
              <Card key={f.title} className="bg-card/80 backdrop-blur-sm border-border hover:border-primary/30 transition-colors group">
                <CardContent className="p-6">
                  <div className={`h-11 w-11 rounded-xl ${f.bg} flex items-center justify-center mb-4 transition-colors`}>
                    <f.icon className={`h-5 w-5 ${f.color}`} />
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
          <Link to="/signup">
            <Button size="lg" className="gap-2 text-base px-10 h-12 font-semibold glow-btn">
              أنشئ متجرك الآن
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={silaLogo} alt="Sila" className="h-8 w-auto opacity-80" />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Sila — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
