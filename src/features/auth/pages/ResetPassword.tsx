import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, CheckCircle2, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AuthCard from "@/features/auth/components/AuthCard";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { resetSchema, friendlyAuthError, type ResetValues } from "@/features/auth/lib/auth-schemas";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    return () => subscription.unsubscribe();
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const passwordValue = useWatch({ control, name: "password" }) || "";

  const onSubmit = async (values: ResetValues) => {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate("/login"), 2500);
  };

  if (success) {
    return (
      <AuthCard title="تم تغيير كلمة المرور" subtitle="سيتم تحويلك لصفحة تسجيل الدخول...">
        <ResetSteps step={4} />
        <div className="mx-auto mt-6 w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_28px_-6px_hsl(var(--primary)/0.6)]">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
      </AuthCard>
    );
  }

  if (!isRecovery) {
    return (
      <AuthCard title="رابط غير صالح" subtitle="هذا الرابط غير صالح أو منتهي الصلاحية.">
        <div className="space-y-4 text-center">
          <Lock className="h-10 w-10 text-destructive mx-auto" />
          <Button onClick={() => navigate("/forgot-password")} variant="outline" className="w-full">
            طلب رابط جديد
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="إعادة تعيين كلمة المرور" subtitle="اختر كلمة مرور قوية (8 أحرف على الأقل تتضمن حروف وأرقام).">
      <ResetSteps step={3} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">كلمة المرور الجديدة</Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordStrengthMeter password={passwordValue} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base font-semibold glow-btn">
          {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}
          تعيين كلمة المرور
        </Button>
      </form>
    </AuthCard>
  );
}

function ResetSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items = [
    { i: 1, label: "طلب", icon: Mail },
    { i: 2, label: "بريد", icon: Mail },
    { i: 3, label: "كلمة جديدة", icon: KeyRound },
    { i: 4, label: "تم", icon: CheckCircle2 },
  ];
  return (
    <div className="flex items-center justify-between mb-5">
      {items.map((it, idx) => {
        const done = step > it.i;
        const active = step === it.i;
        const Icon = it.icon;
        return (
          <div key={it.i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                  done
                    ? "bg-primary border-primary text-primary-foreground"
                    : active
                    ? "bg-primary/15 border-primary text-primary"
                    : "bg-muted/30 border-border text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span
                className={`text-[10px] ${
                  active || done ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {it.label}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}