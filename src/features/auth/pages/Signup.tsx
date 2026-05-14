import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import AuthCard from "@/features/auth/components/AuthCard";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import GoogleAuthButton from "@/features/auth/components/GoogleAuthButton";
import { SyrianPhoneInput } from "@/shared/components/inputs/SyrianPhoneInput";
import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";
import { signupSchema, friendlyAuthError, type SignupValues } from "@/features/auth/lib/auth-schemas";

const CITIES = [
  "دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "ريف دمشق",
  "دير الزور", "الرقة", "الحسكة", "درعا", "السويداء", "إدلب", "القنيطرة",
];

export default function Signup() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      storeName: "",
      contactPerson: "",
      phone: "",
      city: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignupValues) => {
    if (!isValidSyrianPhone(values.phone)) {
      toast.error("رقم سوري غير صحيح. مثال: 0933123456");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          role: "merchant",
          store_name: values.storeName,
          contact_person: values.contactPerson,
          phone: values.phone,
          city: values.city,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    toast.success("تم إنشاء الحساب! تحقق من بريدك لتأكيد التسجيل");
    navigate("/verify-email", { state: { email: values.email }, replace: true });
  };

  const loading = submitting || isSubmitting;

  return (
    <AuthCard
      wide
      title="أنشئ حسابك في صلة"
      subtitle="ابدأ بإدارة طلباتك وشحناتك مع شركات الشحن المعتمدة"
    >
      <motion.form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم المتجر" error={errors.storeName?.message}>
            <Input placeholder="متجر الأناقة" {...register("storeName")} />
          </Field>
          <Field label="اسم المسؤول" error={errors.contactPerson?.message}>
            <Input placeholder="أحمد محمد" {...register("contactPerson")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="رقم الهاتف" error={errors.phone?.message}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => <SyrianPhoneInput value={field.value} onChange={field.onChange} required />}
            />
          </Field>
          <Field label="المدينة" error={errors.city?.message}>
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدينة" />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field label="البريد الإلكتروني" error={errors.email?.message}>
          <Input type="email" dir="ltr" placeholder="you@store.com" autoComplete="email" {...register("email")} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="كلمة المرور" error={errors.password?.message}>
            <PasswordInput
              placeholder="8 أحرف على الأقل"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
          </Field>
          <Field label="تأكيد كلمة المرور" error={errors.confirmPassword?.message}>
            <PasswordInput
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
          </Field>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          باستخدام كلمة مرور قوية (8 أحرف على الأقل تتضمن حروف وأرقام). سنرسل رابط تأكيد إلى بريدك قبل تفعيل الحساب.
        </p>

        <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
          {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ArrowRight className="me-2 h-4 w-4 rtl-flip" />}
          إنشاء الحساب
        </Button>
      </motion.form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
        <div className="relative flex justify-center"><span className="bg-card/60 px-3 text-xs text-muted-foreground">أو</span></div>
      </div>

      <GoogleAuthButton label="التسجيل عبر Google" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        لديك حساب بالفعل؟{" "}
        <Link to="/login" className="text-primary hover:underline font-medium">تسجيل الدخول</Link>
      </p>
    </AuthCard>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}