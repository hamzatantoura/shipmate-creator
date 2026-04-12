import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Truck, Mail, ArrowRight } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(217_33%_16%)_0%,_hsl(222_47%_11%)_70%)]" />
        </div>
        <Card className="w-full max-w-md border-primary/30 bg-card text-center relative z-10">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">تحقق من بريدك الإلكتروني</h2>
            <p className="text-muted-foreground text-sm">
              إذا كان البريد <span className="font-medium text-foreground" dir="ltr">{email}</span> مرتبطاً بحساب موثق،
              فستصلك رسالة تحتوي على رابط لإعادة تعيين كلمة المرور.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-4 gap-2">
                <ArrowRight className="h-4 w-4" />
                العودة لتسجيل الدخول
              </Button>
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

      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">نسيت كلمة المرور</CardTitle>
          <p className="text-sm text-muted-foreground">أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@sila.sy"
                className="text-left"
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              إرسال رابط إعادة التعيين
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline font-medium">
              العودة لتسجيل الدخول
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
