import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Store, Package, ShieldCheck } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";

const STORAGE_PREFIX = "sila.onboarding.dismissed.";

const STEPS = [
  {
    Icon: Sparkles,
    title: "أهلاً بك في صلة",
    body:
      "صلة منصة شحن متكاملة تربط متجرك بأفضل شركات التوصيل في سوريا. هذه جولة سريعة تشرح الخطوات القادمة.",
  },
  {
    Icon: Store,
    title: "أكمل ملف متجرك",
    body:
      "ارفع شعار المتجر، ووثّق بياناتك (هوية، عنوان مستودع، رقم تواصل). هذه البيانات شرط أساسي لاعتماد الإدارة.",
  },
  {
    Icon: Package,
    title: "أضف منتجاتك من الآن",
    body:
      "تستطيع إضافة المنتجات أثناء انتظار التفعيل — ستُحفظ كمسودات وتُنشر تلقائياً فور اعتماد حسابك.",
  },
  {
    Icon: ShieldCheck,
    title: "بانتظار التفعيل",
    body:
      "بعد استكمال البيانات سيُراجع فريقنا حسابك خلال وقت قصير، وسنُعلِمك فور التفعيل لتبدأ الشحن.",
  },
] as const;

export default function MerchantOnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  // Open on first login per-user
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (!localStorage.getItem(storageKey)) {
        setStep(0);
        setOpen(true);
      }
    } catch {
      /* no-op */
    }
  }, [storageKey]);

  // Allow the banner to replay the tour
  useEffect(() => {
    const replay = () => { setStep(0); setOpen(true); };
    window.addEventListener("sila:replay-onboarding", replay);
    return () => window.removeEventListener("sila:replay-onboarding", replay);
  }, []);

  const dismiss = () => {
    try { if (storageKey) localStorage.setItem(storageKey, "1"); } catch { /* no-op */ }
    setOpen(false);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.Icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-xl font-display">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper dots */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex flex-row-reverse items-center justify-between sm:justify-between gap-2">
          {isLast ? (
            <Button asChild className="flex-1" onClick={dismiss}>
              <Link to="/merchant/settings">ابدأ الإعداد</Link>
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}>
              التالي
            </Button>
          )}
          <Button variant="ghost" onClick={dismiss}>
            تخطي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}