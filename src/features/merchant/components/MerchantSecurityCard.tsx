import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { passwordSchema } from "@/features/auth/lib/auth-schemas";
import { friendlyAuthError } from "@/features/auth/lib/auth-schemas";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound, CheckCircle2 } from "lucide-react";

/**
 * Security card — lets the merchant set or change their account password.
 * Works for both email/password users and Google-OAuth users (in which case
 * setting a password adds an email/password method to the same account, so
 * they can sign in either way).
 */
export default function MerchantSecurityCard() {
  const { profile } = useAuth();
  const isGoogleOnly = profile?.auth_provider === "google";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "كلمة مرور غير صالحة");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    setPassword("");
    setConfirm("");
    // Mark profile so we stop showing the "set password" banner.
    if (isGoogleOnly && profile) {
      await supabase
        .from("profiles")
        .update({ auth_provider: "google+password" })
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
    }
    toast.success(
      isGoogleOnly
        ? "تم تعيين كلمة المرور — يمكنك الآن الدخول عبر Google أو البريد"
        : "تم تحديث كلمة المرور بنجاح"
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          الأمان وكلمة المرور
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isGoogleOnly && (
          <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80 flex items-start gap-2">
            <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              حسابك مرتبط بـ Google فقط. عيّن كلمة مرور لتتمكن من تسجيل الدخول بالبريد عند تعذّر الوصول إلى Google. ستبقى Google تعمل كما هي.
            </span>
          </div>
        )}
        {!isGoogleOnly && (
          <p className="mb-4 text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            يمكنك تغيير كلمة المرور في أي وقت.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">
              {isGoogleOnly ? "كلمة المرور الجديدة" : "كلمة المرور الجديدة"}
            </Label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل"
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
            <PasswordInput
              id="confirm-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={loading || !password} className="w-full">
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isGoogleOnly ? "تعيين كلمة المرور" : "تحديث كلمة المرور"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}