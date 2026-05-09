import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/shared/components/layout/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings, Loader2, Save, DollarSign, ShieldCheck, Truck, Globe } from "lucide-react";
import { toast } from "sonner";
import { invalidatePlatformSettings } from "@/shared/hooks/use-platform-settings";

type Resp = "merchant" | "platform" | "carrier";
type VerifMode = "beta" | "production";

interface Form {
  // financial
  marginPct: string;
  marginFlat: string;
  collectionPct: string;
  returnFee: string;
  resp: Resp;
  marginVisible: boolean;
  collectionVisible: boolean;
  // verification
  verifMode: VerifMode;
  allowIntl: boolean;
  // shipping
  freeShipThreshold: string;
  publicCouriersVisible: boolean;
  // public/wallet
  minPayout: string;
  whatsapp: string;
  productMaxImages: string;
}

const DEFAULTS: Form = {
  marginPct: "10",
  marginFlat: "0",
  collectionPct: "1",
  returnFee: "5000",
  resp: "merchant",
  marginVisible: false,
  collectionVisible: true,
  verifMode: "beta",
  allowIntl: true,
  freeShipThreshold: "0",
  publicCouriersVisible: true,
  minPayout: "50000",
  whatsapp: "",
  productMaxImages: "5",
};

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [f, setF] = useState<Form>(DEFAULTS);

  const setField = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("platform_settings" as any).select("*").limit(1).maybeSingle();
      const r = data as any;
      if (r) {
        setId(r.id);
        setF({
          marginPct: String(r.default_platform_margin_pct ?? 10),
          marginFlat: String(r.default_platform_margin_flat ?? 0),
          collectionPct: String(r.default_collection_fee_pct ?? 1),
          returnFee: String(r.default_return_fee ?? 5000),
          resp: (r.return_cost_responsibility as Resp) || "merchant",
          marginVisible: !!r.platform_margin_visible,
          collectionVisible: r.collection_fee_visible !== false,
          verifMode: r.verification_mode === "production" ? "production" : "beta",
          allowIntl: r.allow_international_phones !== false,
          freeShipThreshold: String(r.default_free_shipping_threshold ?? 0),
          publicCouriersVisible: r.public_couriers_visible !== false,
          minPayout: String(r.min_payout_amount ?? 50000),
          whatsapp: r.platform_whatsapp || "",
          productMaxImages: String(r.product_max_images ?? 5),
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload: any = {
      default_platform_margin_pct: parseFloat(f.marginPct) || 0,
      default_platform_margin_flat: parseFloat(f.marginFlat) || 0,
      default_collection_fee_pct: parseFloat(f.collectionPct) || 0,
      default_return_fee: parseFloat(f.returnFee) || 0,
      return_cost_responsibility: f.resp,
      platform_margin_visible: f.marginVisible,
      collection_fee_visible: f.collectionVisible,
      verification_mode: f.verifMode,
      allow_international_phones: f.allowIntl,
      default_free_shipping_threshold: parseFloat(f.freeShipThreshold) || 0,
      public_couriers_visible: f.publicCouriersVisible,
      min_payout_amount: parseFloat(f.minPayout) || 0,
      platform_whatsapp: f.whatsapp || null,
      product_max_images: parseInt(f.productMaxImages) || 5,
    };
    const q = id
      ? await supabase.from("platform_settings" as any).update(payload).eq("id", id)
      : await supabase.from("platform_settings" as any).insert({ singleton: true, ...payload });
    setSaving(false);
    if (q.error) { toast.error(q.error.message); return; }
    invalidatePlatformSettings();
    toast.success("تم حفظ إعدادات المنصة ✓");
  };

  const reset = () => { setF(DEFAULTS); toast.info("أُعيدت القيم للافتراضيات (لم تُحفظ بعد)"); };

  if (loading) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <AppHeader />
        <div className="text-center py-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" /> إعدادات المنصة
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>إعادة للقيم الافتراضية</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ
            </Button>
          </div>
        </div>

        <Tabs defaultValue="finance" dir="rtl">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="finance" className="gap-1.5"><DollarSign className="h-4 w-4" /> مالية</TabsTrigger>
            <TabsTrigger value="verify" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> تحقق</TabsTrigger>
            <TabsTrigger value="shipping" className="gap-1.5"><Truck className="h-4 w-4" /> شحن</TabsTrigger>
            <TabsTrigger value="public" className="gap-1.5"><Globe className="h-4 w-4" /> عامة</TabsTrigger>
          </TabsList>

          {/* ===== Finance ===== */}
          <TabsContent value="finance" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-foreground">القواعد المالية</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>نسبة عمولة المنصة (%)</Label>
                  <Input type="number" min="0" step="0.1" value={f.marginPct} onChange={(e) => setField("marginPct", e.target.value)} />
                  <p className="text-xs text-muted-foreground">تُحتسب على كل طلب. القيمة المرجعية: 10%.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>إظهار عمولة المنصة للتاجر</Label>
                    <p className="text-xs text-muted-foreground">إذا أُطفئت، تبقى العمولة مخفية في حسابات التاجر.</p>
                  </div>
                  <Switch checked={f.marginVisible} onCheckedChange={(v) => setField("marginVisible", v)} />
                </div>

                <div className="space-y-1.5">
                  <Label>هامش ثابت إضافي (ل.س)</Label>
                  <Input type="number" min="0" value={f.marginFlat} onChange={(e) => setField("marginFlat", e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>نسبة بدل التحصيل (%)</Label>
                  <Input type="number" min="0" step="0.1" value={f.collectionPct} onChange={(e) => setField("collectionPct", e.target.value)} />
                  <p className="text-xs text-muted-foreground">القيمة المرجعية: 1%.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>إظهار بدل التحصيل للتاجر</Label>
                    <p className="text-xs text-muted-foreground">عادةً ظاهر للشفافية.</p>
                  </div>
                  <Switch checked={f.collectionVisible} onCheckedChange={(v) => setField("collectionVisible", v)} />
                </div>

                <div className="space-y-1.5">
                  <Label>رسم الإرجاع الافتراضي (ل.س)</Label>
                  <Input type="number" min="0" value={f.returnFee} onChange={(e) => setField("returnFee", e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>مسؤولية تكلفة الإرجاع</Label>
                  <Select value={f.resp} onValueChange={(v) => setField("resp", v as Resp)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merchant">التاجر يتحمل</SelectItem>
                      <SelectItem value="platform">المنصة تتحمل</SelectItem>
                      <SelectItem value="carrier">شركة الشحن تتحمل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>الحد الأدنى لسحب الرصيد (ل.س)</Label>
                  <Input type="number" min="0" value={f.minPayout} onChange={(e) => setField("minPayout", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Verification ===== */}
          <TabsContent value="verify" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-foreground">التحقق والامتثال</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>وضع التحقق</Label>
                  <Select value={f.verifMode} onValueChange={(v) => setField("verifMode", v as VerifMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beta">بيتا (مرن)</SelectItem>
                      <SelectItem value="production">إنتاج (صارم)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">في وضع البيتا يُسمح بمرونة في تأكيد الهاتف/البريد بغرض التجربة.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>قبول الأرقام الدولية</Label>
                    <p className="text-xs text-muted-foreground">إذا أُطفئت، تُقبل الأرقام السورية فقط.</p>
                  </div>
                  <Switch checked={f.allowIntl} onCheckedChange={(v) => setField("allowIntl", v)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Shipping ===== */}
          <TabsContent value="shipping" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-foreground">إعدادات الشحن</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>حد الشحن المجاني الافتراضي (ل.س)</Label>
                  <Input type="number" min="0" value={f.freeShipThreshold} onChange={(e) => setField("freeShipThreshold", e.target.value)} />
                  <p className="text-xs text-muted-foreground">يُستخدم كقيمة مقترحة عند إنشاء متجر جديد. يمكن للتاجر تعديلها.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>إظهار دليل شركات الشحن للعامة</Label>
                    <p className="text-xs text-muted-foreground">يتحكم في ظهور الشركات للزوار غير المسجلين.</p>
                  </div>
                  <Switch checked={f.publicCouriersVisible} onCheckedChange={(v) => setField("publicCouriersVisible", v)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Public ===== */}
          <TabsContent value="public" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-foreground">الواجهة العامة</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>رقم واتساب المنصة الرسمي</Label>
                  <Input dir="ltr" type="tel" placeholder="+963..." value={f.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} />
                  <p className="text-xs text-muted-foreground">يُستخدم في صفحات الدعم والاتصال.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>الحد الأقصى لصور المنتج</Label>
                  <Input type="number" min="1" max="20" value={f.productMaxImages} onChange={(e) => setField("productMaxImages", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-1.5 min-w-[160px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ جميع الإعدادات
          </Button>
        </div>
      </main>
    </div>
  );
}
