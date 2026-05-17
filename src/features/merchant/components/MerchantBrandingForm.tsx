import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { toast } from "sonner";
import { Loader2, Store, MessageCircle, Facebook, Instagram, Globe, Camera, Pencil, Send } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { compressImage } from "@/shared/lib/image-compress";

export default function MerchantBrandingForm() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("merchants")
      .select("store_name, banner_url, logo_url, bio, operating_hours, whatsapp_number, social_links, external_website_url")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setStoreName(d.store_name || "");
          setBannerUrl(d.banner_url || null);
          setLogoUrl(d.logo_url || null);
          setBio(d.bio || "");
          setHours(d.operating_hours || "");
          setWhatsapp(d.whatsapp_number || "");
          setWebsite(d.external_website_url || "");
          const sl = (d.social_links || {}) as Record<string, string>;
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
    if (url) { setBannerUrl(url); toast.success("تم تحديث الغلاف"); }
  };
  const handleLogo = async (file: File) => {
    const url = await uploadFile(file, "product-images");
    if (url) { setLogoUrl(url); toast.success("تم تحديث الشعار"); }
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
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ هوية المتجر");
    setEditOpen(false);
  };

  if (loading) return <div className="text-muted-foreground text-sm">جاري التحميل...</div>;

  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}` : null;

  const formBody = (
    <div className="space-y-5">
      {/* Banner preview + input */}
      <div className="space-y-2">
        <Label>غلاف المتجر</Label>
        <div
          onClick={() => bannerInputRef.current?.click()}
          className="group relative aspect-[16/6] rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer"
        >
          {bannerUrl
            ? <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
            : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Camera className="h-8 w-8" /></div>}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm gap-1.5">
            <Camera className="h-4 w-4" /> تغيير الغلاف
          </div>
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleBanner(e.target.files[0])} />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label>شعار المتجر</Label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => logoInputRef.current?.click()}
            className="group relative h-20 w-20 rounded-full overflow-hidden border border-border bg-muted/30 flex items-center justify-center shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              : <Store className="h-7 w-7 text-muted-foreground" />}
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </span>
          </button>
          <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
            <Camera className="h-4 w-4 ml-1" /> رفع شعار
          </Button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleLogo(e.target.files[0])} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>اسم المتجر</Label>
        <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="مثال: متجر النور" maxLength={80} />
      </div>

      <div className="space-y-2">
        <Label>نبذة</Label>
        <Textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="عرّف زبائنك بمتجرك..." maxLength={300} />
      </div>

      <div className="space-y-2">
        <Label>ساعات العمل</Label>
        <Textarea rows={2} value={hours} onChange={e => setHours(e.target.value)} placeholder="مثال: السبت – الخميس 9ص – 10م" maxLength={200} />
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <div className="text-sm font-semibold">وسائل التواصل</div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" /> واتساب</Label>
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
            <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> الموقع</Label>
            <Input dir="ltr" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </div>
    </div>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>إلغاء</Button>
      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
        حفظ
      </Button>
    </>
  );

  return (
    <>
      {/* ===== VIEW MODE ===== */}
      <Card className="overflow-hidden border-border">
        {/* Cover */}
        <button
          type="button"
          onClick={() => { setEditOpen(true); setTimeout(() => bannerInputRef.current?.click(), 100); }}
          className="group relative block w-full h-36 sm:h-48 bg-gradient-to-l from-primary/25 via-primary/10 to-transparent overflow-hidden"
          aria-label="تغيير صورة الغلاف"
        >
          {bannerUrl && <img src={bannerUrl} alt="" className="w-full h-full object-cover" />}
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-3 py-1.5 text-xs font-medium text-foreground shadow opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-3.5 w-3.5" /> تعديل الغلاف
          </span>
        </button>

        <CardContent className="pt-0">
          <div className="flex items-end gap-4 -mt-12 sm:-mt-14">
            {/* Logo */}
            <button
              type="button"
              onClick={() => { setEditOpen(true); setTimeout(() => logoInputRef.current?.click(), 100); }}
              className="group relative h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-4 border-background bg-muted shrink-0 shadow-lg"
              aria-label="تغيير شعار المتجر"
            >
              {logoUrl
                ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 text-muted-foreground" /></span>}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </span>
            </button>

            <div className="flex-1 pb-2 min-w-0">
              <div className="font-display font-bold text-lg sm:text-xl text-foreground truncate">
                {storeName || "اسم متجرك"}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {bio || "نبذة قصيرة عن متجرك"}
              </div>
            </div>

            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> تعديل
            </Button>
          </div>

          {/* Social icons */}
          {(waHref || facebook || instagram || tiktok || telegram || website) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {waHref && (
                <a href={waHref} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors" aria-label="واتساب">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors" aria-label="فيسبوك">
                  <Facebook className="h-4 w-4 text-primary" />
                </a>
              )}
              {instagram && (
                <a href={instagram} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors" aria-label="إنستغرام">
                  <Instagram className="h-4 w-4 text-primary" />
                </a>
              )}
              {telegram && (
                <a href={telegram} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors" aria-label="تيليغرام">
                  <Send className="h-4 w-4 text-primary" />
                </a>
              )}
              {website && (
                <a href={website} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors" aria-label="الموقع">
                  <Globe className="h-4 w-4 text-primary" />
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== EDIT — Sheet on mobile, Dialog on desktop ===== */}
      {isMobile ? (
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 flex flex-col">
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-right">
              <SheetTitle>تعديل هوية المتجر</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {formBody}
            </div>
            <SheetFooter className="px-5 py-3 border-t border-border gap-2 flex-row justify-end bg-background">
              {footerButtons}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>تعديل هوية المتجر</DialogTitle>
            </DialogHeader>
            {formBody}
            <DialogFooter className="gap-2">
              {footerButtons}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
