import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";

const ADMIN_EMAILS = new Set(["hamza.tantoura@gmail.com"]);

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Username workaround: if no '@', treat as courier username
    const identifier = email.trim();
    const loginEmail = identifier.includes("@")
      ? identifier
      : `${identifier.toLowerCase().replace(/[^a-z0-9_]/g, "")}@courier.sila.local`;

    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const role = (roleRows?.[0]?.role as "admin" | "merchant" | "vendor" | undefined)
        ?? (ADMIN_EMAILS.has(data.user.email ?? "") ? "admin" : null);

      const routes = {
        admin: "/admin",
        merchant: "/merchant",
        vendor: "/vendor",
      } as const;

      navigate(role ? routes[role] : "/login", { replace: true });

      if (!role) {
        toast.error("لم يتم العثور على صلاحية لهذا الحساب");
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(217_33%_16%)_0%,_hsl(222_47%_11%)_70%)]" />
        <svg className="w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="loginGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(187 100% 50%)" strokeWidth="0.3" opacity="0.08" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
        </svg>
      </div>

      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl text-primary">Sila — صلة</CardTitle>
          <p className="text-sm text-muted-foreground">سجّل دخولك إلى المنصة</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني أو اسم المستخدم</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@sila.sy أو fast_express"
                className="text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold glow-btn">
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تسجيل الدخول
            </Button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              ليس لديك حساب؟{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                سجّل كتاجر
              </Link>
            </p>
            <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
