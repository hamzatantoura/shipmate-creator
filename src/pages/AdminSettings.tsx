import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { invalidatePlatformSettings } from "@/hooks/use-platform-settings";

type Resp = "merchant" | "platform" | "carrier";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [marginPct, setMarginPct] = useState("10");
  const [marginFlat, setMarginFlat] = useState("0");
  const [collectionPct, setCollectionPct] = useState("1");
  const [returnFee, setReturnFee] = useState("0");
  const [resp, setResp] = useState<Resp>("merchant");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("platform_settings" as any).select("*").limit(1).maybeSingle();
      const r = data as any;
      if (r) {
        setId(r.id);
        setMarginPct(String(r.default_platform_margin_pct ?? 10));
        setMarginFlat(String(r.default_platform_margin_flat ?? 0));
        setCollectionPct(String(r.default_collection_fee_pct ?? 1));
        setReturnFee(String(r.default_return_fee ?? 0));
        setResp((r.return_cost_responsibility as Resp) || "merchant");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      default_platform_margin_pct: parseFloat(marginPct) || 0,
      default_platform_margin_flat: parseFloat(marginFlat) || 0,
      default_collection_fee_pct: parseFloat(collectionPct) || 0,
      default_return_fee: parseFloat(returnFee) || 0,
      return_cost_responsibility: resp,
    };
    const q = id
      ? await supabase.from("platform_settings" as any).update(payload).eq("id", id)
      : await supabase.from("platform_settings" as any).insert({ singleton: true, ...payload });
    setSaving(false);
    if (q.error) {
      toast.error(q.error.message);
      return;
    }
    invalidatePlatformSettings();
    toast.success("تم حفظ إعدادات المنصة ✓");
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> إعدادات المنصة
        </h1>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">القواعد المالية الديناميكية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>هامش المنصة الافتراضي (%) من رسم الشاحن</Label>
                <Input type="number" min="0" step="0.1" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
                <p className="text-xs text-muted-foreground">يُضاف فوق رسم شركة الشحن الصافي ويظهر للتاجر كرسم شحن.</p>
              </div>

              <div className="space-y-1.5">
                <Label>هامش ثابت إضافي (ل.س) — يدوي</Label>
                <Input type="number" min="0" step="1" value={marginFlat} onChange={(e) => setMarginFlat(e.target.value)} />
                <p className="text-xs text-muted-foreground">مبلغ ثابت يُضاف يدوياً فوق هامش النسبة المئوية. يبقى مخفياً عن التاجر ضمن "رسوم الشحن".</p>
              </div>

              <div className="space-y-1.5">
                <Label>بدل التحصيل الافتراضي (%) من قيمة COD</Label>
                <Input type="number" min="0" step="0.1" value={collectionPct} onChange={(e) => setCollectionPct(e.target.value)} />
                <p className="text-xs text-muted-foreground">يُستخدم فقط إذا لم يحدد الشاحن قيمة خاصة.</p>
              </div>

              <div className="space-y-1.5">
                <Label>مسؤولية تكلفة الإرجاع</Label>
                <Select value={resp} onValueChange={(v) => setResp(v as Resp)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merchant">التاجر يتحمل</SelectItem>
                    <SelectItem value="platform">المنصة تتحمل</SelectItem>
                    <SelectItem value="carrier">شركة الشحن تتحمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>رسم إرجاع افتراضي (ل.س)</Label>
                <Input type="number" min="0" value={returnFee} onChange={(e) => setReturnFee(e.target.value)} />
              </div>

              <Button onClick={save} disabled={saving} className="w-full gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الإعدادات
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}