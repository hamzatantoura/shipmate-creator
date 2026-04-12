import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

type ShippingPolicy = "customer_pays" | "free_all" | "free_above";

export default function MerchantShippingSettings() {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<ShippingPolicy>("customer_pays");
  const [threshold, setThreshold] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("merchants")
      .select("shipping_policy, free_shipping_threshold")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPolicy((data as any).shipping_policy || "customer_pays");
          setThreshold(String((data as any).free_shipping_threshold || 0));
        }
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("merchants")
      .update({
        shipping_policy: policy,
        free_shipping_threshold: policy === "free_above" ? parseFloat(threshold) || 0 : 0,
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("فشل حفظ الإعدادات");
    } else {
      toast.success("تم حفظ إعدادات الشحن بنجاح");
    }
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          إعدادات الشحن
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={policy} onValueChange={(v) => setPolicy(v as ShippingPolicy)} className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <RadioGroupItem value="customer_pays" id="customer_pays" />
            <Label htmlFor="customer_pays" className="cursor-pointer flex-1">
              <p className="font-medium text-foreground">الشحن على العميل</p>
              <p className="text-xs text-muted-foreground">يدفع العميل رسوم التوصيل عند الطلب</p>
            </Label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <RadioGroupItem value="free_all" id="free_all" />
            <Label htmlFor="free_all" className="cursor-pointer flex-1">
              <p className="font-medium text-foreground">شحن مجاني لجميع الطلبات</p>
              <p className="text-xs text-muted-foreground">لا تظهر رسوم شحن للعميل</p>
            </Label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <RadioGroupItem value="free_above" id="free_above" />
            <Label htmlFor="free_above" className="cursor-pointer flex-1">
              <p className="font-medium text-foreground">شحن مجاني فوق مبلغ معين</p>
              <p className="text-xs text-muted-foreground">شحن مجاني إذا تجاوز الطلب الحد المحدد</p>
            </Label>
          </div>
        </RadioGroup>

        {policy === "free_above" && (
          <div className="space-y-1.5">
            <Label>الحد الأدنى للشحن المجاني (ل.س)</Label>
            <Input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="مثال: 100000"
            />
          </div>
        )}

        <Button onClick={save} disabled={saving} className="w-full glow-btn">
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Check className="h-4 w-4 ml-2" />}
          حفظ الإعدادات
        </Button>
      </CardContent>
    </Card>
  );
}
