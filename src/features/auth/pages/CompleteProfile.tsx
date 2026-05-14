import { useEffect, useState, forwardRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Store, User, MapPin, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SyrianPhoneInput } from "@/shared/components/inputs/SyrianPhoneInput";
import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";
import AuthCard from "@/features/auth/components/AuthCard";
import { toast } from "sonner";

const CITIES = [
  "دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "ريف دمشق",
  "دير الزور", "الرقة", "الحسكة", "درعا", "السويداء", "إدلب", "القنيطرة",
];

const schema = z.object({
  storeName: z.string().trim().min(2, "اسم المتجر مطلوب"),
  contactPerson: z.string().trim().min(2, "اسم المسؤول مطلوب"),
  phone: z.string().trim().min(8, "رقم الهاتف مطلوب"),
  city: z.string().min(1, "اختر المدينة"),
});
type Values = z.infer<typeof schema>;

/**
 * Onboarding screen for users who signed in via Google (or any OAuth flow)
 * before they have a merchant record. Forces them to provide store details,
 * then provisions: profiles update + user_roles + merchants row.
 */
export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeName: "",
      contactPerson: (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || "",
      phone: "",
      city: "",
    },
  });

  // Defensive bounce: if a fully-onboarded user lands here, send them home.
  useEffect(() => {
    if (!authLoading && user && profile && !profile.needs_onboarding) {
      navigate("/merchant", { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const onSubmit = async (values: Values) => {
    if (!isValidSyrianPhone(values.phone)) {
      toast.error("رقم سوري غير صحيح. مثال: 0933123456");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Update profile with merchant data
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          store_name: values.storeName,
          contact_person: values.contactPerson,
          phone: values.phone,
          city: values.city,
          role: "merchant",
          needs_onboarding: false,
        } as any)
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      // 2. Create the role row (merchant)
      const { error: rErr } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "merchant" } as any);
      // Ignore unique-violation if it already exists
      if (rErr && !/duplicate key|unique/i.test(rErr.message)) throw rErr;

      // 3. Create the merchants row (pending approval)
      const { error: mErr } = await supabase
        .from("merchants")
        .insert({
          user_id: user.id,
          store_name: values.storeName,
          contact_person: values.contactPerson,
          phone: values.phone,
          city: values.city,
          email_confirmed: !!user.email_confirmed_at,
          verification_status: "pending_admin_approval",
        } as any);
      if (mErr && !/duplicate key|unique/i.test(mErr.message)) throw mErr;

      toast.success("تم إكمال البيانات! جاري تحويلك للوحة التحكم");
      // Hard reload so AuthProvider re-fetches the new profile + role
      window.location.href = "/merchant";
    } catch (err: any) {
      toast.error("تعذر حفظ البيانات: " + (err?.message ?? "خطأ غير معروف"));
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      wide
      title="أكمل بيانات متجرك"
      subtitle={`أهلاً ${user.user_metadata?.full_name ?? user.email} — خطوة أخيرة قبل البدء`}
    >
      <motion.form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-foreground/80">
            دخولك عبر Google موثّق. نحتاج فقط بيانات متجرك لإكمال التسجيل — لا حاجة لكلمة مرور.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم المتجر" error={errors.storeName?.message}>
            <InputWithIcon icon={Store} placeholder="متجر الأناقة" {...register("storeName")} />
          </Field>
          <Field label="اسم المسؤول" error={errors.contactPerson?.message}>
            <InputWithIcon icon={User} placeholder="أحمد محمد" {...register("contactPerson")} />
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
                  <SelectTrigger className="ps-10 relative">
                    <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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

        <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
          <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
          بعد الإرسال، سيراجع فريق صلة حسابك خلال 24 ساعة لتفعيل ميزة إنشاء الشحنات.
        </p>

        <Button type="submit" disabled={submitting} className="w-full h-11 text-base font-semibold glow-btn">
          {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ArrowRight className="me-2 h-4 w-4 rtl-flip" />}
          إكمال التسجيل
        </Button>
      </motion.form>
    </AuthCard>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const InputWithIcon = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { icon: React.ElementType }
>(function InputWithIcon({ icon: Icon, className, ...props }, ref) {
  return (
    <div className="relative">
      <Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input ref={ref} className={`ps-10 ${className ?? ""}`} {...props} />
    </div>
  );
});