import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Check, Store, Phone, MapPin, User } from "lucide-react";
import { toast } from "sonner";

type ShippingPolicy = "customer_pays" | "free_all" | "free_above";

// Testing mode: accept international numbers (+90xxx, +963xxx, 09xxx, etc.)
const INTL_PHONE_REGEX = /^\+?\d{7,15}$/;
function isValidPhone(phone: string): boolean {
  return INTL_PHONE_REGEX.test(phone.replace(/[\s-]/g, ""));
}

export default function MerchantShippingSettings() {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<ShippingPolicy>("customer_pays");
  const [threshold, setThreshold] = useState("0");
  const [storeName, setStoreName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [city, setCity] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [districts, setDistricts] = useState<{ id: string; province_ar: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("merchants").select("*").eq("user_id", user.id).single(),
      supabase.from("districts").select("id, province_ar").eq("is_active", true).order("province_ar"),
    ]).then(([{ data: m }, { data: d }]) => {
      if (m) {
        const merchant = m as any;
        setPolicy(merchant.shipping_policy || "customer_pays");
        setThreshold(String(merchant.free_shipping_threshold || 0));
        setStoreName(merchant.store_name || "");
        setContactPerson(merchant.contact_person || "");
        setPhone(merchant.phone || "");
        setWhatsappNumber(merchant.whatsapp_number || merchant.phone || "");
        setCity(merchant.city || "");
      }
      if (d) {
        // Deduplicate by province_ar
        const seen = new Set<string>();
        setDistricts((d as any[]).filter(x => {
          if (seen.has(x.province_ar)) return false;
          seen.add(x.province_ar);
          return true;
        }));
      }
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (!storeName.trim()) { toast.error("اسم المتجر مطلوب"); return; }
    if (!contactPerson.trim()) { toast.error("اسم التاجر مطلوب"); return; }
    if (!phone.trim() || !isValidPhone(phone)) { toast.error("رقم الهاتف غير صحيح — مثال: +905xxxxxxxxx"); return; }
    if (!whatsappNumber.trim() || !isValidPhone(whatsappNumber)) { toast.error("رقم واتساب غير صحيح — مثال: +905xxxxxxxxx"); return; }
    if (!city.trim()) { toast.error("يرجى اختيار المحافظة"); return; }

    setSaving(true);
    // Update merchants table
    const { error: e1 } = await supabase
      .from("merchants")
      .update({
        store_name: storeName.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        whatsapp_number: whatsappNumber.trim(),
        city: city.trim(),
        shipping_policy: policy,
        free_shipping_threshold: policy === "free_above" ? parseFloat(threshold) || 0 : 0,
      } as any)
      .eq("user_id", user.id);

    // Also update profile
    await supabase.from("profiles").update({
      store_name: storeName.trim(),
      contact_person: contactPerson.trim(),
      phone: phone.trim(),
      city: city.trim(),
    }).eq("user_id", user.id);

    setSaving(false);
    if (e1) { toast.error("فشل حفظ الإعدادات"); return; }
    toast.success("تم حفظ الإعدادات بنجاح ✓");
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Store Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Store className="h-5 w-5 text-primary" />
            بيانات المتجر الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> اسم المتجر <span className="text-destructive">*</span></Label>
            <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="مثال: متجر الأناقة" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> اسم التاجر <span className="text-destructive">*</span></Label>
            <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="الاسم الكامل" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> رقم الهاتف <span className="text-destructive">*</span></Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" placeholder="0912345678" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> رقم واتساب <span className="text-destructive">*</span></Label>
            <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} dir="ltr" placeholder="0912345678" />
            <p className="text-xs text-muted-foreground">سيستخدم هذا الرقم لزر تأكيد الطلب عبر واتساب</p>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span></Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
              <SelectContent>
                {districts.map(d => (
                  <SelectItem key={d.id} value={d.province_ar}>{d.province_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Settings className="h-5 w-5 text-primary" />
            سياسة الشحن
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
                <p className="text-xs text-muted-foreground">لا تظهر رسوم شحن للعميل — التاجر يتحمل التكلفة</p>
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
              <Input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="مثال: 100000" />
            </div>
          )}

          <Button onClick={save} disabled={saving} className="w-full glow-btn">
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Check className="h-4 w-4 ml-2" />}
            حفظ جميع الإعدادات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
