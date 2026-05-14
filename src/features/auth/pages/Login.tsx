import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight, Mail, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AuthCard from "@/features/auth/components/AuthCard";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import GoogleAuthButton from "@/features/auth/components/GoogleAuthButton";
import { loginSchema, friendlyAuthError, type LoginValues } from "@/features/auth/lib/auth-schemas";

export default function Login() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "مساء الخير";
    if (h < 12) return "صباح الخير";
    if (h < 18) return "نهارك سعيد";
    return "مساء الخير";
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    const id = values.identifier.trim();
    const loginEmail = id.includes("@")
      ? id
      : `${id.toLowerCase().replace(/[^a-z0-9_]/g, "")}@courier.sila.local`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: values.password,
    });
    if (error) {
      toast.error(friendlyAuthError(error));
      setSubmitting(false);
      return;
    }
    if (data.user) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const role = (roleRows?.[0]?.role as "admin" | "merchant" | "vendor" | undefined) ?? null;

      // Real merchants/admins must verify their email; vendor accounts use
      // synthetic emails and are pre-confirmed by the admin who created them.
      const isSyntheticVendor = loginEmail.endsWith("@courier.sila.local");
      if (!isSyntheticVendor && !data.user.email_confirmed_at) {
        navigate("/verify-email", { state: { email: data.user.email }, replace: true });
        return;
      }

      const routes = { admin: "/admin", merchant: "/merchant", vendor: "/courier/orders" } as const;
      navigate(role ? routes[role] : "/login", { replace: true });
      if (!role) toast.error("لم يتم العثور على صلاحية لهذا الحساب");
    }
    setSubmitting(false);
  };

  const loading = submitting || isSubmitting;

  return (
    <AuthCard
      title={`${greeting} 👋`}
      subtitle="سجّل دخولك إلى لوحة صلة لإدارة طلباتك وشحناتك"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="login"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="space-y-1.5"
            >
              <Label htmlFor="identifier">البريد الإلكتروني أو اسم المستخدم</Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="identifier"
                  type="text"
                  dir="ltr"
                  placeholder="example@sila.sy"
                  autoComplete="username"
                  {...register("identifier")}
                  aria-invalid={!!errors.identifier}
                  className={`ps-10 ${errors.identifier ? "border-destructive" : ""}`}
                />
              </div>
              {errors.identifier && (
                <p className="text-xs text-destructive">{errors.identifier.message}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.18 }}
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base font-semibold glow-btn"
              >
                {loading ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="me-2 h-4 w-4" />
                )}
                تسجيل الدخول
                {!loading && <ArrowRight className="ms-2 h-4 w-4 rtl-flip opacity-70" />}
              </Button>
            </motion.div>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card/60 px-3 text-xs text-muted-foreground">أو</span>
            </div>
          </div>

          <GoogleAuthButton />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              سجّل كتاجر
            </Link>
          </p>
        </motion.div>
      </AnimatePresence>
    </AuthCard>
  );
}