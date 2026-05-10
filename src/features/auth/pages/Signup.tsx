import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Truck, Store } from "lucide-react";
import { SyrianPhoneInput } from "@/shared/components/inputs/SyrianPhoneInput";
import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";
import { useLanguage } from "@/i18n/use-language";

const CITIES = ["دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "ريف دمشق", "دير الزور", "الرقة", "الحسكة", "درعا", "السويداء", "إدلب", "القنيطرة"];

export default function Signup() {
  const { t } = useTranslation("auth");
  const { meta } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) { toast.error(t("signup.errors.selectCity")); return; }
    if (!isValidSyrianPhone(phone)) { toast.error(t("signup.errors.invalidPhone")); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { role: "merchant", store_name: storeName, contact_person: contactPerson, phone, city } },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-start sm:items-center justify-center bg-background p-4 py-8 overflow-y-auto" dir={meta.dir}>
        <Card className="w-full max-w-md border-primary/30 bg-card text-center">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">{t("signup.successTitle")}</h2>
            <p className="text-muted-foreground">{t("signup.successDesc")}</p>
            <Link to="/login"><Button className="mt-4 glow-btn">{t("signup.goLogin")}</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-start sm:items-center justify-center bg-background p-4 py-8 overflow-y-auto" dir={meta.dir}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(217_33%_16%)_0%,_hsl(222_47%_11%)_70%)]" />
      </div>
      <Card className="w-full max-w-lg border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">{t("signup.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("signup.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("signup.storeName")}</Label>
                <Input value={storeName} onChange={e => setStoreName(e.target.value)} required placeholder={t("signup.storeNamePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("signup.contactPerson")}</Label>
                <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} required placeholder={t("signup.contactPersonPlaceholder")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("signup.phone")}</Label>
                <SyrianPhoneInput value={phone} onChange={setPhone} required />
              </div>
              <div className="space-y-2">
                <Label>{t("signup.city")}</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger><SelectValue placeholder={t("signup.cityPlaceholder")} /></SelectTrigger>
                  <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder={t("signup.emailPlaceholder")} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("password")}</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("signup.submit")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("signup.haveAccount")}{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">{t("signIn")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
