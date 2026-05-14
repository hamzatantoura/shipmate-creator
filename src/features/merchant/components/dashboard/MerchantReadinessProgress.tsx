import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMerchantApproval } from "@/features/merchant/hooks/use-merchant-approval";

interface Item {
  label: string;
  ok: boolean;
  weight: number;
  href?: string;
}

/**
 * Visual readiness tracker shown on the merchant dashboard.
 *
 * Weights: profile checks 40% / KYC docs 30% / at least 1 product 20% /
 * admin approval 10%.
 */
export default function MerchantReadinessProgress() {
  const { user } = useAuth();
  const { status, checks, loading } = useMerchantApproval();
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", user.id)
      .is("deleted_at", null)
      .then(({ count }) => setProductCount(count ?? 0));
  }, [user]);

  if (loading || status === "verified") return null;

  // Profile-related checks (everything except KYC docs from useMerchantVerification)
  const profileKeys = ["email_confirmed", "store_name", "contact_person", "city", "shipping_policy"];
  const kycKeys = ["id_front_url", "id_back_url", "verification_video_url", "logo_url"];

  const profileDone = checks.filter((c) => profileKeys.includes(c.key) && c.ok).length;
  const profileTotal = profileKeys.length;
  const kycDone = checks.filter((c) => kycKeys.includes(c.key) && c.ok).length;
  const kycTotal = kycKeys.length;

  const items: Item[] = [
    { label: `الملف الشخصي (${profileDone}/${profileTotal})`, ok: profileDone === profileTotal, weight: 40, href: "/merchant/settings" },
    { label: `وثائق التحقق (${kycDone}/${kycTotal})`, ok: kycDone === kycTotal, weight: 30, href: "/merchant/settings" },
    { label: `المنتجات${productCount != null ? ` (${productCount})` : ""}`, ok: (productCount ?? 0) >= 1, weight: 20, href: "/merchant/products" },
    { label: "الاعتماد الإداري", ok: status === "verified", weight: 10 },
  ];

  const earned = items.filter((i) => i.ok).reduce((s, i) => s + i.weight, 0);

  return (
    <Card className="border-primary/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-5 w-5 text-primary" />
          جاهزية الإطلاق
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-display font-bold text-foreground">{earned}%</span>
            <span className="text-xs text-muted-foreground">جاهز للإطلاق</span>
          </div>
          <Progress value={earned} className="h-2" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((it) => (
            <div
              key={it.label}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                it.ok ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {it.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{it.label}</span>
              <span className="text-[10px] text-muted-foreground">{it.weight}%</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <Link to="/merchant/settings">إكمال الخطوات</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}