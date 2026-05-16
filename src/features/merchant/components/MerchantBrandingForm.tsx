import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ImagePlus, Store, MessageCircle, Facebook, Instagram, Globe } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { compressImage } from "@/shared/lib/image-compress";

export default function MerchantBrandingForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [bio, setBio] = useState("");
  const [hours, setHours] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("merchants")
      .select("store_name, banner_url, logo_url, bio, operating_hours, whatsapp_number, social_links, external_website_url")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStoreName((data as any).store_name || "");
          setBannerUrl((data as any).banner_url || null);
          setLogoUrl((data as any).logo_url || null);
          setBio((data as any).bio || "");
          setHours((data as any).operating_hours || "");
          setWhatsapp((data as any).whatsapp_number || "");
          setWebsite((data as any).external_website_url || "");
          const sl = ((data as any).social_links || {}) as Record<string, string>;
          setFacebook(sl.facebook || "");
          setInstagram(sl.instagram || "");
          setTiktok(sl.tiktok || "");
          setTelegram(sl.telegram || "");
        }
        setLoading(false);
      });
  }, [user]);

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    if (!user) return null;
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, compressed, { upsert: true });
    if (error) { toast.error("فشل رفع الصورة"); return null; }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const handleBanner = async (file: File) => {
    const url = await uploadFile(file, "store-banners");
    if (url) setBannerUrl(url);
  };
  const handleLogo = async (file: File) => {
    // logos go in the existing merchant-assets bucket if present, otherwise reuse product-images
    const url = await uploadFile(file, "product-images");
    if (url) setLogoUrl(url);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const social_links: Record<string, string> = {};
    if (facebook.trim()) social_links.facebook = facebook.trim();
    if (instagram.trim()) social_links.instagram = instagram.trim();
    if (tiktok.trim()) social_links.tiktok = tiktok.trim();
    if (telegram.trim()) social_links.telegram = telegram.trim();
    const { error } = await supabase.from("merchants")
      .update({
        store_name: storeName.trim() || "متجر",
        banner_url: bannerUrl,
        logo_url: logoUrl,
        bio: bio.trim() || null,
        operating_hours: hours.trim() || null,
        whatsapp_number: whatsapp.trim() || null,
        external_website_url: website.trim() || null,
        social_links,
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("تم حفظ هوية المتجر");
  };

  if (loading) return <div className="text-muted-foreground text-sm">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Live preview header */}
      <Card className="overflow-hidden border-border">
        <div className="relative h-28 sm:h-36 bg-gradient-to-l from-primary/20 via-primary/10 to-transparent">
          {bannerUrl && <img src={bannerUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <CardContent className="pt-0 -mt-10 sm:-mt-12 flex items-end gap-4">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-4 border-background bg-muted shrink-0 flex items-center justify-center">
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              : <Store className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="pb-2 min-w-0">
            <div className="font-display font-bold text-lg text-foreground truncate">{storeName || "اسم متجرك"}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{bio || "نبذة قصيرة عن متجرك ستظهر هنا"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">هوية المتجر</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>اسم المتجر</Label>
          <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="مثال: متجر النور" maxLength={80} />
        </div>

        <div className="space-y-2">
          <Label>غلاف المتجر (Banner)</Label>
          <div className="relative aspect-[16/6] rounded-lg overflow-hidden border border-border bg-muted/30">
            {bannerUrl ? (
              <img src={bannerUrl} alt="غلاف" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <ImagePlus className="h-8 w-8" />
              </div>
            )}
          </div>
          <Input type="file" accept="image/*"
            onChange={e => e.target.files?.[0] && handleBanner(e.target.files[0])} />
        </div>

        <div className="space-y-2">
          <Label>شعار المتجر (دائري)</Label>
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 rounded-full overflow-hidden border border-border bg-muted/30 flex items-center justify-center shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="شعار" className="w-full h-full object-cover" />
              ) : (
                <Store className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <Input type="file" accept="image/*"
              onChange={e => e.target.files?.[0] && handleLogo(e.target.files[0])} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>نبذة عن المتجر</Label>
          <Textarea rows={3} value={bio} onChange={e => setBio(e.target.value)}
            placeholder="عرّف زبائنك بمتجرك بجملتين..." maxLength={300} />
        </div>

        <div className="space-y-2">
          <Label>ساعات العمل</Label>
          <Textarea rows={2} value={hours} onChange={e => setHours(e.target.value)}
            placeholder="مثال: السبت – الخميس 9ص – 10م، الجمعة مغلق" maxLength={200} />
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">معلومات التواصل وروابط التواصل الاجتماعي</div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" /> رقم واتساب الأعمال</Label>
            <Input dir="ltr" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+9639xxxxxxxx" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5 text-primary" /> فيسبوك</Label>
              <Input dir="ltr" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5 text-primary" /> إنستغرام</Label>
              <Input dir="ltr" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-2">
              <Label>تيك توك</Label>
              <Input dir="ltr" value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="https://tiktok.com/@..." />
            </div>
            <div className="space-y-2">
              <Label>تيليغرام</Label>
              <Input dir="ltr" value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="https://t.me/..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> الموقع الإلكتروني</Label>
              <Input dir="ltr" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full glow-btn">
          {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          حفظ هوية المتجر
        </Button>
        </CardContent>
      </Card>
    </div>
  );
}