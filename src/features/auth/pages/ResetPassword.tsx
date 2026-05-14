import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AuthCard from "@/features/auth/components/AuthCard";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
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
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

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
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
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
          {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          تعيين كلمة المرور
        </Button>
      </form>
    </AuthCard>
  );
}