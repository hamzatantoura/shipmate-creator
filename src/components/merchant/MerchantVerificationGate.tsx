import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchantVerification } from "@/hooks/use-merchant-verification";
import { compressImage } from "@/lib/image-compress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  AlertCircle, CheckCircle2, Upload, Shield, Loader2,
  ShieldCheck, Clock, Mail, Phone, MessageCircle, Settings,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
}

export default function MerchantVerificationGate({ children }: Props) {
  const { user } = useAuth();
  const verification = useMerchantVerification();

  // Email verification
  const [sendingEmail, setSendingEmail] = useState(false);

  // Phone OTP verification
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verifying">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // ID upload
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (verification.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (verification.isVerified) {
    return <>{children}</>;
  }

  // === Email Verification ===
  const handleResendEmail = async () => {
    if (!user?.email) return;
    setSendingEmail(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    setSendingEmail(false);
    if (error) {
      toast.error("فشل إرسال رابط التحقق: " + error.message);
    } else {
      toast.success("تم إرسال رابط التحقق إلى بريدك الإلكتروني ✓");
    }
  };

  // === Phone OTP (Simulated for testing) ===
  const handleSendOtp = async () => {
    if (!verification.phone?.trim()) {
      toast.error("يرجى إضافة رقم الهاتف أولاً من تبويب الإعدادات");
      return;
    }
    setSendingOtp(true);
    // Simulate OTP generation
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpStep("sent");
    setSendingOtp(false);
    // In testing mode, show the OTP as a toast
    toast.info(`رمز التحقق (وضع الاختبار): ${code}`, { duration: 15000 });
  };

  const handleVerifyOtp = async () => {
    if (otpCode !== generatedOtp) {
      toast.error("رمز التحقق غير صحيح");
      return;
    }
    if (!user) return;
    setOtpStep("verifying");
    const { error } = await supabase
      .from("merchants")
      .update({ phone_verified: true } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("فشل تحديث حالة التحقق");
      setOtpStep("sent");
      return;
    }
    toast.success("تم تأكيد رقم الهاتف بنجاح ✓");
    setOtpStep("idle");
    setOtpCode("");
    verification.refetch();
  };

  // === ID Upload with compression ===
  const handleUploadId = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("حجم الملف يجب أن لا يتجاوز 20 ميغابايت");
      return;
    }

    setUploading(true);

    // Compress image before upload
    const compressed = await compressImage(file, 1600, 0.85);

    const ext = compressed.name.split(".").pop() || "jpg";
    const path = `id-documents/${user.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("uploads")
      .upload(path, compressed, { upsert: true });

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
    toast.success("تم رفع صورة الهوية بنجاح ✓");
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
    pending_admin_approval: {
      icon: ShieldCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      title: "بانتظار الموافقة الإدارية",
      description: "تم استكمال جميع متطلبات التحقق. حسابك قيد المراجعة من فريق صلة وسيتم تفعيله بعد الموافقة.",
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

  // Critical checks that block activation
  const criticalChecks = verification.checks.filter(c =>
    ["email", "phone_verified", "id_image"].includes(c.key)
  );
  const profileChecks = verification.checks.filter(c =>
    !["email", "phone_verified", "id_image"].includes(c.key)
  );

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

      {/* Critical Verification Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Shield className="h-5 w-5 text-primary" />
            خطوات التحقق الإلزامية
          </CardTitle>
          <p className="text-xs text-muted-foreground">يجب إكمال الخطوات الثلاث التالية لتفعيل المتجر</p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* 1. Email Verification */}
          <div className={`p-4 rounded-lg border transition-colors ${
            verification.email_confirmed
              ? "border-primary/20 bg-primary/5"
              : "border-destructive/20 bg-destructive/5"
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {verification.email_confirmed ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Mail className="h-5 w-5 text-destructive shrink-0" />
              )}
              <span className={`text-sm font-medium ${verification.email_confirmed ? "text-foreground" : "text-destructive"}`}>
                تأكيد البريد الإلكتروني
              </span>
              {verification.email_confirmed && (
                <span className="mr-auto text-xs text-primary">✓ مؤكد</span>
              )}
            </div>
            {!verification.email_confirmed && (
              <div className="mr-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  تحقق من بريدك <span className="font-medium text-foreground">{user?.email}</span> واضغط رابط التأكيد.
                  إذا لم تجده تحقق من مجلد الرسائل غير المرغوبة.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendEmail}
                  disabled={sendingEmail}
                  className="gap-1.5"
                >
                  {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  إعادة إرسال رابط التحقق
                </Button>
              </div>
            )}
          </div>

          {/* 2. Phone OTP Verification */}
          <div className={`p-4 rounded-lg border transition-colors ${
            verification.phone_verified
              ? "border-primary/20 bg-primary/5"
              : "border-destructive/20 bg-destructive/5"
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {verification.phone_verified ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Phone className="h-5 w-5 text-destructive shrink-0" />
              )}
              <span className={`text-sm font-medium ${verification.phone_verified ? "text-foreground" : "text-destructive"}`}>
                تأكيد رقم الهاتف
              </span>
              {verification.phone_verified && (
                <span className="mr-auto text-xs text-primary">✓ مؤكد</span>
              )}
            </div>
            {!verification.phone_verified && (
              <div className="mr-8 space-y-3">
                {verification.phone ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      سيتم إرسال رمز تحقق إلى الرقم: <span className="font-medium text-foreground" dir="ltr">{verification.phone}</span>
                    </p>
                    {otpStep === "idle" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                        className="gap-1.5"
                      >
                        {sendingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                        إرسال رمز التحقق
                      </Button>
                    )}
                    {(otpStep === "sent" || otpStep === "verifying") && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">أدخل رمز التحقق المكون من 6 أرقام:</p>
                        <div dir="ltr" className="flex justify-start">
                          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleVerifyOtp}
                            disabled={otpCode.length !== 6 || otpStep === "verifying"}
                            className="gap-1.5"
                          >
                            {otpStep === "verifying" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            تأكيد الرمز
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSendOtp}
                            disabled={sendingOtp}
                          >
                            إعادة الإرسال
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    يرجى إضافة رقم الهاتف أولاً من تبويب <span className="font-bold text-foreground">"الإعدادات"</span>.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. ID Image Upload */}
          <div className={`p-4 rounded-lg border transition-colors ${
            verification.id_image_url
              ? "border-primary/20 bg-primary/5"
              : "border-destructive/20 bg-destructive/5"
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {verification.id_image_url ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Upload className="h-5 w-5 text-destructive shrink-0" />
              )}
              <span className={`text-sm font-medium ${verification.id_image_url ? "text-foreground" : "text-destructive"}`}>
                رفع صورة الهوية
              </span>
              {verification.id_image_url && (
                <span className="mr-auto text-xs text-primary">✓ تم الرفع</span>
              )}
            </div>
            {!verification.id_image_url && (
              <div className="mr-8 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadId}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-dashed border-2"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  رفع صورة الهوية
                </Button>
                <p className="text-xs text-muted-foreground">
                  صورة واضحة للهوية الشخصية (بحد أقصى 20 MB — يتم ضغطها تلقائياً)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile Completion Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Settings className="h-5 w-5 text-primary" />
            بيانات المتجر المطلوبة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profileChecks.map((check) => (
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

          {profileChecks.some(c => !c.ok) && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              يمكنك إكمال بيانات المتجر من تبويب <span className="font-bold text-foreground">"الإعدادات"</span> أدناه.
            </p>
          )}
        </CardContent>
      </Card>

      {/* All checks done but not yet verified */}
      {verification.allChecksPassed && !verification.isVerified && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-6 text-center space-y-2">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm font-medium text-foreground">
              تم استكمال جميع المتطلبات!
            </p>
            <p className="text-xs text-muted-foreground">
              حسابك قيد المراجعة من فريق صلة. سيتم تفعيل متجرك خلال فترة قصيرة.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

