import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShieldCheck,
  Upload,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  Video,
  Building2,
  MapPin,
  IdCard,
} from "lucide-react";

type Slot =
  | "id_front_url"
  | "id_back_url"
  | "verification_video_url"
  | "logo_url";

interface MerchantKyc {
  id_front_url: string | null;
  id_back_url: string | null;
  verification_video_url: string | null;
  logo_url: string | null;
  warehouse_address: string | null;
}

const EMPTY: MerchantKyc = {
  id_front_url: null,
  id_back_url: null,
  verification_video_url: null,
  logo_url: null,
  warehouse_address: null,
};

const BUCKET_FOR: Record<Slot, "merchant-kyc" | "merchant-logos"> = {
  id_front_url: "merchant-kyc",
  id_back_url: "merchant-kyc",
  verification_video_url: "merchant-kyc",
  logo_url: "merchant-logos",
};

export default function MerchantKycCard({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<MerchantKyc>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [savingAddr, setSavingAddr] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<Slot | null>(null);
  const inputs = useRef<Record<Slot, HTMLInputElement | null>>({
    id_front_url: null,
    id_back_url: null,
    verification_video_url: null,
    logo_url: null,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase
        .from("merchants")
        .select("id_front_url, id_back_url, verification_video_url, logo_url, warehouse_address")
        .eq("user_id", user.id)
        .maybeSingle();
      if (m) setData(m as any);
      setLoading(false);
    })();
  }, [user]);

  const handleUpload = async (slot: Slot, file: File) => {
    if (!user) return;
    setUploadingSlot(slot);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${slot}-${Date.now()}.${ext}`;
      const bucket = BUCKET_FOR[slot];
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;

      let url = "";
      if (bucket === "merchant-logos") {
        url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      } else {
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        url = signed?.signedUrl || path;
      }

      const { error: updErr } = await supabase
        .from("merchants")
        .update({ [slot]: url } as any)
        .eq("user_id", user.id);
      if (updErr) throw updErr;

      setData((d) => ({ ...d, [slot]: url }));
      toast.success("تم الرفع بنجاح ✓");
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "فشل الرفع");
    } finally {
      setUploadingSlot(null);
    }
  };

  const saveAddress = async () => {
    if (!user) return;
    setSavingAddr(true);
    const { error } = await supabase
      .from("merchants")
      .update({ warehouse_address: data.warehouse_address?.trim() || null } as any)
      .eq("user_id", user.id);
    setSavingAddr(false);
    if (error) {
      toast.error("فشل حفظ العنوان");
      return;
    }
    toast.success("تم حفظ عنوان المستودع ✓");
    onSaved?.();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const slot = (
    key: Slot,
    label: string,
    icon: React.ReactNode,
    accept: string,
    helper: string,
  ) => {
    const filled = !!data[key];
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
          filled ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background border border-border">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {label}
            {filled && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
          </p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <input
          ref={(el) => (inputs.current[key] = el)}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(key, f);
          }}
        />
        <Button
          size="sm"
          variant={filled ? "outline" : "default"}
          onClick={() => inputs.current[key]?.click()}
          disabled={uploadingSlot === key}
          className="gap-1.5 shrink-0"
        >
          {uploadingSlot === key ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {filled ? "استبدال" : "رفع"}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            توثيق الهوية (KYC)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {slot(
            "id_front_url",
            "صورة الهوية – الوجه الأمامي",
            <IdCard className="h-5 w-5 text-primary" />,
            "image/*",
            "JPG/PNG، أقل من 5 ميغا",
          )}
          {slot(
            "id_back_url",
            "صورة الهوية – الوجه الخلفي",
            <IdCard className="h-5 w-5 text-primary" />,
            "image/*",
            "JPG/PNG، أقل من 5 ميغا",
          )}
          {slot(
            "verification_video_url",
            "فيديو تحقق (5 ثوانٍ)",
            <Video className="h-5 w-5 text-primary" />,
            "video/*",
            "سجّل فيديو سيلفي قصير لتأكيد الهوية",
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="h-5 w-5 text-primary" />
            هوية المتجر والمستودع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {slot(
            "logo_url",
            "شعار المتجر",
            <ImageIcon className="h-5 w-5 text-primary" />,
            "image/*",
            "يُعرض على واجهة المتجر العامة",
          )}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> عنوان المستودع <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={data.warehouse_address || ""}
              onChange={(e) => setData({ ...data, warehouse_address: e.target.value })}
              placeholder="مثال: حلب – السليمانية – بناء رقم 12، طابق 2"
              rows={2}
            />
            <Button onClick={saveAddress} disabled={savingAddr} size="sm" className="w-full gap-1.5">
              {savingAddr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              حفظ عنوان المستودع
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}