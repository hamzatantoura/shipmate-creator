import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AuthCard from "@/features/auth/components/AuthCard";
import { friendlyAuthError } from "@/features/auth/lib/auth-schemas";
import { useAuth } from "@/features/auth/hooks/use-auth";

/**
 * Shown when a user has signed up but hasn't clicked the confirmation link yet.
 * Lets them resend the email or sign out.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const email = (location.state as { email?: string } | null)?.email ?? user?.email ?? "";
  const [sending, setSending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error("لا يوجد بريد إلكتروني");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    if (error) toast.error(friendlyAuthError(error));
    else toast.success("تم إرسال رابط التأكيد مجدداً");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <AuthCard title="تحقق من بريدك الإلكتروني" subtitle="أرسلنا لك رابط تأكيد. افتح بريدك واضغط الرابط لتفعيل حسابك.">
      <div className="space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        {email && (
          <p className="text-center text-sm text-muted-foreground" dir="ltr">
            <span className="text-foreground font-medium">{email}</span>
          </p>
        )}
        <Button onClick={handleResend} disabled={sending} className="w-full h-11 glow-btn">
          {sending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          إعادة إرسال رابط التأكيد
        </Button>
        <div className="flex flex-col gap-2">
          <Link to="/login" className="text-center text-sm text-primary hover:underline">
            العودة إلى تسجيل الدخول
          </Link>
          {user && (
            <button
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5"
            >
              <LogOut className="h-3 w-3" /> تسجيل الخروج
            </button>
          )}
        </div>
      </div>
    </AuthCard>
  );
}