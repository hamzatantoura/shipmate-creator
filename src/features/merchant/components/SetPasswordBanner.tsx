import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { KeyRound, X } from "lucide-react";

const DISMISS_KEY = "sila.set_password_banner.dismissed";

/**
 * Shown to merchants who signed up via Google and have not yet set a
 * password — encourages them to add one for account recovery.
 */
export default function SetPasswordBanner() {
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(
    typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1"
  );

  if (dismissed) return null;
  if (profile?.auth_provider !== "google") return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
      <KeyRound className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-medium">عيّن كلمة مرور لحسابك</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          سجّلت عبر Google. أضف كلمة مرور لتتمكن من الدخول بالبريد عند الحاجة — ستبقى Google تعمل أيضاً.
        </p>
        <Button asChild size="sm" className="mt-2 h-8">
          <Link to="/merchant/settings#security">تعيين كلمة المرور</Link>
        </Button>
      </div>
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}