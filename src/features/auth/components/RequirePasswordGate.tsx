import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { passwordSchema, friendlyAuthError } from "@/features/auth/lib/auth-schemas";
import { toast } from "sonner";
import { Loader2, KeyRound, ShieldAlert } from "lucide-react";

/**
 * Mandatory password setup for merchants who signed in via Google and have
 * not set a password yet. Cannot be dismissed — blocks the app until done.
 */
export default function RequirePasswordGate({ children }: { children: React.ReactNode }) {
  const { role, profile, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const mustSet =
    role === "merchant" && !!user && profile?.auth_provider === "google";

  if (!mustSet) return <>{children}</>;

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
    if (error) {
      setLoading(false);
      toast.error(friendlyAuthError(error));
      return;
    }
    await supabase
      .from("profiles")
      .update({ auth_provider: "google+password" } as any)
      .eq("user_id", user.id);
    toast.success("تم تعيين كلمة المرور بنجاح");
    // Force a session refresh so AuthProvider re-reads the updated profile.
    await supabase.auth.refreshSession();
    setLoading(false);
  };

  return (
    <>
      {children}
      <Dialog open onOpenChange={() => { /* not dismissible */ }}>
        <DialogContent
          dir="rtl"
          className="max-w-md [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center text-xl font-display">
              تأمين حسابك مطلوب
            </DialogTitle>
            <DialogDescription className="text-center leading-relaxed">
              لحماية متجرك، يجب تعيين كلمة مرور قبل المتابعة. ستتمكن لاحقاً من
              تسجيل الدخول عبر Google أو عبر البريد + كلمة المرور.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-3 pt-2">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80 flex items-start gap-2">
              <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>هذه الخطوة لمرة واحدة فقط ولا يمكن تخطيها.</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate-password">كلمة المرور الجديدة</Label>
              <PasswordInput
                id="gate-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 أحرف على الأقل"
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={password} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate-confirm">تأكيد كلمة المرور</Label>
              <PasswordInput
                id="gate-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تعيين كلمة المرور والمتابعة
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}