import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { useLanguage } from "@/i18n/use-language";
import LanguageSwitcher from "@/shared/components/i18n/LanguageSwitcher";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const { meta } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const identifier = email.trim();
    const loginEmail = identifier.includes("@")
      ? identifier
      : `${identifier.toLowerCase().replace(/[^a-z0-9_]/g, "")}@courier.sila.local`;

    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      const code = (error as any)?.code ?? "";
      let friendly = error.message;
      if (/invalid[_ ]?credentials/i.test(code) || /invalid login/i.test(error.message)) {
        friendly = t("login.errors.invalidCredentials");
      } else if (/email[_ ]not[_ ]confirmed/i.test(error.message)) {
        friendly = t("login.errors.emailNotConfirmed");
      }
      console.error("[Login] signIn failed", { loginEmail, code, message: error.message });
      toast.error(`${friendly} (${error.message})`);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const role = (roleRows?.[0]?.role as "admin" | "merchant" | "vendor" | undefined) ?? null;
      const routes = { admin: "/admin", merchant: "/merchant", vendor: "/courier/orders" } as const;
      navigate(role ? routes[role] : "/login", { replace: true });
      if (!role) toast.error(t("login.errors.noRole"));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={meta.dir}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(217_33%_16%)_0%,_hsl(222_47%_11%)_70%)]" />
      </div>
      <div className="absolute top-4 end-4 z-20">
        <LanguageSwitcher variant="outline" />
      </div>
      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">{t("login.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.identifierLabel")}</Label>
              <Input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder={t("login.identifierPlaceholder")} className="text-left" dir="ltr" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("password")}</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t("forgotPassword")}</Link>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder={t("login.passwordPlaceholder")} minLength={6} dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("login.submit")}
            </Button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("login.noAccount")}{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">{t("login.registerAsMerchant")}</Link>
            </p>
            <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              {t("login.backHome")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
