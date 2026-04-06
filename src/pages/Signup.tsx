import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Truck, Store } from "lucide-react";

const CITIES = ["دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "ريف دمشق", "دير الزور", "الرقة", "الحسكة", "درعا", "السويداء", "إدلب", "القنيطرة"];

export default function Signup() {
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
    if (!city) { toast.error("الرجاء اختيار المدينة"); return; }
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "merchant",
          store_name: storeName,
          contact_person: contactPerson,
          phone,
          city,
        },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="w-full max-w-md border-primary/30 bg-card text-center">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">تم إنشاء الحساب بنجاح!</h2>
            <p className="text-muted-foreground">تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل دخولك.</p>
            <Link to="/login">
              <Button className="mt-4 glow-btn">الذهاب لتسجيل الدخول</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(217_33%_16%)_0%,_hsl(222_47%_11%)_70%)]" />
      </div>

      <Card className="w-full max-w-lg border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">التسجيل كتاجر</CardTitle>
          <p className="text-sm text-muted-foreground">أنشئ حسابك وابدأ ببيع منتجاتك مع خدمات الشحن المتكاملة</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المتجر</Label>
                <Input value={storeName} onChange={e => setStoreName(e.target.value)} required placeholder="متجر الأناقة" />
              </div>
              <div className="space-y-2">
                <Label>اسم المسؤول</Label>
                <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} required placeholder="أحمد محمد" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+963 9XX XXX XXX" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                  <SelectContent>
                    {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@store.com" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              إنشاء الحساب
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">تسجيل الدخول</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
