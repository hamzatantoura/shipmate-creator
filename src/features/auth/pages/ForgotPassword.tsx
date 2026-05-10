import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Truck, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/use-language";

export default function ForgotPassword() {
  const { t } = useTranslation("auth");
  const { meta, isRtl } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-[100dvh] flex items-start sm:items-center justify-center bg-background p-4 py-8 overflow-y-auto" dir={meta.dir}>
        <Card className="w-full max-w-md border-primary/30 bg-card text-center relative z-10">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">{t("forgot.sentTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("forgot.sentBody", { email })}</p>
            <Link to="/login">
              <Button variant="outline" className="mt-4 gap-2"><BackIcon className="h-4 w-4" />{t("forgot.back")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-start sm:items-center justify-center bg-background p-4 py-8 overflow-y-auto" dir={meta.dir}>
      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">{t("forgot.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="example@sila.sy" dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("forgot.submit")}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline font-medium">{t("forgot.back")}</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
