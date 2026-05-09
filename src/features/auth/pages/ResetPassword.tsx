import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Truck, Lock, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/use-language";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const { meta } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error(t("reset.errors.mismatch")); return; }
    if (password.length < 6) { toast.error(t("reset.errors.tooShort")); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { setSuccess(true); setTimeout(() => navigate("/login"), 3000); }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={meta.dir}>
        <Card className="w-full max-w-md border-primary/30 bg-card text-center relative z-10">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">{t("reset.successTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("reset.successDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={meta.dir}>
        <Card className="w-full max-w-md border-destructive/30 bg-card text-center relative z-10">
          <CardContent className="py-12 space-y-4">
            <Lock className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-xl font-display font-bold text-foreground">{t("reset.invalidTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("reset.invalidDesc")}</p>
            <Button onClick={() => navigate("/forgot-password")} variant="outline" className="mt-2">
              {t("reset.requestNew")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={meta.dir}>
      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">{t("reset.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("reset.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("reset.newPassword")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••" minLength={6} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                placeholder="••••••••" minLength={6} dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("reset.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
