import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ReadinessCheck {
  label: string;
  ok: boolean;
}

export function useStoreReadiness() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("store_name, contact_person, phone, city, shipping_policy, whatsapp_number")
        .eq("user_id", user.id)
        .single();

      const m = merchant as any;
      const result: ReadinessCheck[] = [
        { label: "اسم المتجر", ok: !!m?.store_name?.trim() },
        { label: "اسم التاجر", ok: !!m?.contact_person?.trim() },
        { label: "رقم الهاتف", ok: !!m?.phone?.trim() },
        { label: "رقم واتساب", ok: !!m?.whatsapp_number?.trim() || !!m?.phone?.trim() },
        { label: "المحافظة", ok: !!m?.city?.trim() },
        { label: "سياسة الشحن", ok: !!m?.shipping_policy },
      ];
      setChecks(result);
      setReady(result.every(c => c.ok));
      setLoading(false);
    })();
  }, [user]);

  return { checks, ready, loading };
}

export default function StoreReadinessBanner() {
  const { checks, ready, loading } = useStoreReadiness();

  if (loading || ready) return null;

  const missing = checks.filter(c => !c.ok);

  return (
    <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <h3 className="font-display font-bold">متجرك غير جاهز لاستقبال الطلبات</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        يرجى إكمال البيانات التالية في تبويب "الإعدادات" قبل تفعيل متجرك:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-sm ${c.ok ? 'text-primary' : 'text-destructive'}`}>
            {c.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
