import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, ArrowRight, ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AuthCard from "@/features/auth/components/AuthCard";
import { useLanguage } from "@/i18n/use-language";
import { forgotSchema, friendlyAuthError } from "@/features/auth/lib/auth-schemas";
import { z } from "zod";

type Values = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const { isRtl } = useLanguage();
  const [sent, setSent] = useState<string | null>(null);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

  const onSubmit = async (values: Values) => {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(friendlyAuthError(error));
    else setSent(values.email);
  };

  if (sent) {
    return (
      <AuthCard title="تحقق من بريدك" subtitle="إذا كان البريد مسجّلاً لدينا، فستصلك رسالة بإعادة تعيين كلمة المرور.">
        <div className="space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_28px_-6px_hsl(var(--primary)/0.6)]">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <p className="text-center text-sm font-medium text-foreground bg-muted/40 rounded-lg py-2.5 px-4 border border-border/40" dir="ltr">{sent}</p>
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            لم يصلك البريد؟ تحقّق من مجلّد الرسائل غير المرغوبة، أو حاول مرة أخرى بعد دقيقة.
          </p>
          <Link to="/login" className="block">
            <Button variant="outline" className="w-full gap-2"><BackIcon className="h-4 w-4" />العودة لتسجيل الدخول</Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="نسيت كلمة المرور" subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="email"
              type="email"
              dir="ltr"
              placeholder="example@sila.sy"
              autoComplete="email"
              {...register("email")}
              aria-invalid={!!errors.email}
              className={`ps-10 ${errors.email ? "border-destructive" : ""}`}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base font-semibold glow-btn">
          {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <KeyRound className="me-2 h-4 w-4" />}
          إرسال رابط إعادة التعيين
        </Button>
      </form>
      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm text-primary hover:underline font-medium">العودة لتسجيل الدخول</Link>
      </div>
    </AuthCard>
  );
}