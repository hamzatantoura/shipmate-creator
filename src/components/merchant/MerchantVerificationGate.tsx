import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchantVerification } from "@/hooks/use-merchant-verification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Upload, Shield, Loader2, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
}

export default function MerchantVerificationGate({ children }: Props) {
  const { user } = useAuth();
  const verification = useMerchantVerification();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (verification.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Verified → render children
  if (verification.isVerified) {
    return <>{children}</>;
  }

  const handleUploadId = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الملف يجب أن لا يتجاوز 5 ميغابايت");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `id-documents/${user.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("uploads")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      toast.error("فشل رفع الصورة: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: updateErr } = await supabase
      .from("merchants")
      .update({ id_image_url: publicUrl } as any)
      .eq("user_id", user.id);

    setUploading(false);
    if (updateErr) {
      toast.error("فشل تحديث البيانات");
      return;
    }
    toast.success("تم رفع صورة الهوية بنجاح");
    verification.refetch();
  };

  const statusConfig = {
    pending_verification: {
      icon: Clock,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      title: "حسابك قيد التحقق",
      description: "يرجى استكمال متطلبات التحقق التالية لتفعيل متجرك واستقبال الطلبات.",
    },
    rejected: {
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      title: "تم رفض التحقق",
      description: "يرجى مراجعة البيانات وإعادة رفع المستندات المطلوبة.",
    },
  };

  const config = statusConfig[verification.verification_status as keyof typeof statusConfig] || statusConfig.pending_verification;
  const StatusIcon = config.icon;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Status Card */}
      <Card className={`${config.border} ${config.bg}`}>
        <CardContent className="py-8 text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-full ${config.bg} flex items-center justify-center`}>
            <StatusIcon className={`h-8 w-8 ${config.color}`} />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">{config.title}</h2>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Shield className="h-5 w-5 text-primary" />
            متطلبات التحقق والتفعيل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {verification.checks.map((check) => (
            <div
              key={check.key}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                check.ok
                  ? "border-primary/20 bg-primary/5"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              {check.ok ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              )}
              <span className={`text-sm font-medium ${check.ok ? "text-foreground" : "text-destructive"}`}>
                {check.label}
              </span>
              {check.ok && (
                <span className="mr-auto text-xs text-primary">✓ مكتمل</span>
              )}
            </div>
          ))}

          {/* ID Upload Action */}
          {!verification.id_image_url && (
            <div className="pt-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleUploadId}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full gap-2 border-dashed border-2"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                رفع صورة الهوية
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                صورة واضحة للهوية الشخصية (بحد أقصى 5 MB)
              </p>
            </div>
          )}

          {/* Email not confirmed hint */}
          {!verification.email_confirmed && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                📧 تحقق من بريدك الإلكتروني واضغط رابط التأكيد المرسل إليك عند التسجيل.
                إذا لم تجده، تحقق من مجلد الرسائل غير المرغوبة.
              </p>
            </div>
          )}

          {/* All checks done but not yet verified */}
          {verification.allChecksPassed && !verification.isVerified && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center space-y-2">
              <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
              <p className="text-sm font-medium text-foreground">
                تم استكمال جميع المتطلبات!
              </p>
              <p className="text-xs text-muted-foreground">
                حسابك قيد المراجعة من فريق صلة. سيتم تفعيل متجرك خلال فترة قصيرة.
              </p>
            </div>
          )}

          {/* Link to settings for completing info */}
          {verification.missingChecks.some(c => ["store_name", "contact_person", "phone", "whatsapp", "city", "shipping_policy"].includes(c.key)) && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              يمكنك إكمال بيانات المتجر من تبويب <span className="font-bold text-foreground">"الإعدادات"</span> أدناه.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
