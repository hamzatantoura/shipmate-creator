import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ImagePlus, Store } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { compressImage } from "@/shared/lib/image-compress";

export default function MerchantBrandingForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [hours, setHours] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("merchants")
      .select("banner_url, logo_url, bio, operating_hours")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBannerUrl((data as any).banner_url || null);
          setLogoUrl((data as any).logo_url || null);
          setBio((data as any).bio || "");
          setHours((data as any).operating_hours || "");
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
    const { error } = await supabase.from("merchants")
      .update({ banner_url: bannerUrl, logo_url: logoUrl, bio: bio.trim() || null, operating_hours: hours.trim() || null } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("تم حفظ هوية المتجر");
  };

  if (loading) return <div className="text-muted-foreground text-sm">جاري التحميل...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">هوية المتجر</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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

        <Button onClick={save} disabled={saving} className="w-full glow-btn">
          {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          حفظ هوية المتجر
        </Button>
      </CardContent>
    </Card>
  );
}