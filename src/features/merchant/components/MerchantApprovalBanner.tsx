import { Link } from "react-router-dom";
import { AlertCircle, Clock, ShieldCheck, XCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMerchantApproval } from "@/features/merchant/hooks/use-merchant-approval";

const TOUR_STORAGE_PREFIX = "sila.onboarding.dismissed.";

export default function MerchantApprovalBanner() {
  const { status, loading, checks } = useMerchantApproval();

  if (loading || !status || status === "verified") return null;

  const total = checks.length || 1;
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / total) * 100);

  const variants = {
    pending_verification: {
      Icon: Clock,
      tone: "border-amber-500/50 bg-amber-500/15 text-amber-950 dark:text-amber-100",
      iconTone: "text-amber-600 dark:text-amber-400",
      title: "حسابك قيد المراجعة",
      desc: "أكمل بياناتك وأضف منتجاتك (ستُحفظ كمسودات) ريثما يتم تفعيل حسابك من الإدارة.",
    },
    pending_admin_approval: {
      Icon: ShieldCheck,
      tone: "border-blue-500/50 bg-blue-500/15 text-blue-950 dark:text-blue-100",
      iconTone: "text-blue-600 dark:text-blue-400",
      title: "بانتظار الاعتماد الإداري",
      desc: "تم استكمال البيانات المطلوبة. سيتم تفعيل الشحن فور موافقة الإدارة.",
    },
    rejected: {
      Icon: XCircle,
      tone: "border-destructive/50 bg-destructive/15 text-destructive dark:text-destructive-foreground",
      iconTone: "text-destructive",
      title: "تم رفض حسابك",
      desc: "راجع البيانات وحدّثها من الإعدادات ثم أعد التقديم للمراجعة.",
    },
  } as const;

  const v = variants[status as keyof typeof variants] ?? variants.pending_verification;
  const { Icon } = v;

  const replayTour = () => {
    try {
      // Wipe ALL onboarding flags so the tour reopens for current user.
      Object.keys(localStorage)
        .filter((k) => k.startsWith(TOUR_STORAGE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
      window.dispatchEvent(new CustomEvent("sila:replay-onboarding"));
    } catch {
      /* no-op */
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 md:flex-row md:items-center md:justify-between ${v.tone}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${v.iconTone}`} />
        <div className="space-y-0.5">
          <p className="text-sm font-bold">{v.title}</p>
          <p className="text-xs opacity-90">{v.desc}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-background/30 px-2.5 py-1 text-xs font-medium">
          <AlertCircle className="h-3 w-3" />
          جاهزية الحساب: {pct}%
        </span>
        <Button asChild size="sm" variant="secondary" className="h-8">
          <Link to="/merchant/settings">إكمال البيانات</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5"
          onClick={replayTour}
        >
          <Sparkles className="h-3.5 w-3.5" />
          إعادة عرض الجولة
        </Button>
      </div>
    </div>
  );
}