import { useState } from "react";
import { useMerchantVerification } from "@/features/merchant/hooks/use-merchant-verification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Settings,
  ShieldCheck,
} from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function MerchantVerificationGate({ children }: Props) {
  const verification = useMerchantVerification();
  const [resending, setResending] = useState(false);

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

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: (await supabase.auth.getUser()).data.user?.email || "",
      });
      if (error) throw error;
      toast.success("تم إرسال رابط التأكيد إلى بريدك الإلكتروني");
      toast.info("تحقق من مجلد البريد الوارد أو الرسائل غير المرغوب فيها");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء إرسال الرابط");
    } finally {
      setResending(false);
    }
  };

  const statusConfig = {
    pending_verification: {
      icon: Clock,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      title: "أكمل بيانات المتجر",
      description:
        "بعد استكمال البيانات المطلوبة سيتم تحويل الحساب تلقائياً إلى انتظار موافقة الإدارة.",
    },
    pending_admin_approval: {
      icon: ShieldCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      title: "بانتظار الموافقة الإدارية",
      description:
        "تم استكمال البيانات المطلوبة، وبقي فقط اعتماد الإدارة لتفعيل الشحن.",
    },
    rejected: {
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      title: "تم رفض الطلب",
      description:
        "يرجى مراجعة بيانات المتجر وتحديثها ثم انتظار المراجعة مرة أخرى.",
    },
  };

  const config =
    statusConfig[
      verification.verification_status as keyof typeof statusConfig
    ] || statusConfig.pending_verification;
  const StatusIcon = config.icon;
  const profileChecks = verification.checks;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card className={`${config.border} ${config.bg}`}>
        <CardContent className="py-8 text-center space-y-4">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${config.bg}`}
          >
            <StatusIcon className={`h-8 w-8 ${config.color}`} />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">
            {config.title}
          </h2>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Settings className="h-5 w-5 text-primary" />
            بيانات المتجر المطلوبة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profileChecks.map((check) => (
            <div
              key={check.key}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                check.ok
                  ? "border-primary/20 bg-primary/5"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              {check.ok ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              )}
              <span
                className={`text-sm font-medium ${
                  check.ok ? "text-foreground" : "text-destructive"
                }`}
              >
                {check.label}
              </span>

              {check.ok && (
                <span className="mr-auto text-xs text-primary">✓ مكتمل</span>
              )}

              {/* Resend email button */}
              {check.key === "email_confirmed" && !check.ok && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mr-auto gap-1.5 text-xs"
                  onClick={handleResendEmail}
                  disabled={resending}
                >
                  {resending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Mail className="h-3 w-3" />
                  )}
                  إرسال رابط التأكيد
                </Button>
              )}
            </div>
          ))}

          {profileChecks.some((check) => !check.ok) && (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              أكمل هذه البيانات من تبويب{" "}
              <span className="font-bold text-foreground">"الإعدادات"</span>.
            </p>
          )}
        </CardContent>
      </Card>

      {verification.verification_status === "pending_admin_approval" && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="space-y-2 py-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-blue-500" />
            <p className="text-sm font-medium text-foreground">
              تم إرسال الحساب لاعتماد الإدارة
            </p>
            <p className="text-xs text-muted-foreground">
              سيتم تفعيل المتجر للشحن بعد الموافقة الإدارية فقط.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
