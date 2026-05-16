import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package, MapPin, Clock, Truck, ArrowRight, Phone, AlertCircle, CheckCircle2, ShoppingBag, PackageCheck, Bike, Hourglass } from "lucide-react";
import { normalizeSilaCode, validateSilaCode } from "@/features/shipments/lib/sila-code";

const STATUS_AR: Record<string, string> = {
  new: "جديد",
  pending: "قيد الانتظار",
  processing: "قيد المعالجة",
  assigned: "تم تعيين مندوب",
  picked_up: "تم الاستلام",
  out_for_delivery: "خرج للتوصيل",
  in_transit: "قيد التوصيل",
  delivered: "تم التسليم",
  returned: "مرتجع",
  cancelled: "ملغاة",
  failed: "فشل التسليم",
};

const RETURN_REASON_AR: Record<string, string> = {
  customer_refused: "رفض المستلم",
  no_answer: "لا يرد",
  wrong_address: "عنوان خاطئ",
  damaged: "تالف",
  other: "أخرى",
};

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

// Public timeline — 5 Trendyol-style stages. 'returned' is a terminal alt branch.
const TIMELINE = [
  { key: "received", label: "تم استلام الطلب", icon: ShoppingBag },
  { key: "confirmed", label: "تأكيد التاجر", icon: PackageCheck },
  { key: "shipping", label: "مع شركة الشحن", icon: Truck },
  { key: "out_for_delivery", label: "خرج للتوصيل", icon: Bike },
  { key: "delivered", label: "تم التسليم", icon: CheckCircle2 },
];

const STAGE_INDEX: Record<string, number> = {
  new: 0, pending: 0, draft: 0,
  processing: 1, assigned: 1, picked_up: 1, received_by_courier: 1, pending_pickup: 1,
  shipped: 2, in_transit: 2, at_warehouse: 2, in_transit_intercity: 2, with_distributor: 2,
  out_for_delivery: 3,
  delivered: 4,
};

interface TrackResult {
  sila_code: string;
  status: string;
  city: string;
  courier_name: string | null;
  phone_masked: string;
  created_at: string;
  updated_at: string;
  return_reason: string | null;
  has_shipment?: boolean;
}

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const [code, setCode] = useState(initialCode);
  const [data, setData] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (input: string) => {
    const trimmed = normalizeSilaCode(input);
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    setError(null);
    setData(null);

    // Client-side checksum guard for new-format codes (SL-XXXXXXXX-C).
    // Saves a network round-trip on typos. Legacy codes (SL-XXXXXX or
    // SL-XXXXXX-XXXX) bypass this check and go straight to the RPC.
    const isNewFormatShape = /^SL-[A-Z2-9]{8}-[A-Z2-9]$/.test(trimmed);
    if (isNewFormatShape && !validateSilaCode(trimmed)) {
      setError("الرمز غير صحيح. تأكد من نسخه كاملاً دون تعديل.");
      setLoading(false);
      return;
    }

    const { data: result, error: rpcErr } = await supabase.rpc(
      "track_order_by_sila_code" as any,
      { p_code: trimmed }
    );

    if (rpcErr) {
      setError("حدث خطأ، حاول مرة أخرى");
    } else if (result && (result as any).error) {
      const errKey = (result as any).error;
      if (errKey === "not_found") setError("لم نجد طلباً بهذا الرمز. تأكد من الرمز وحاول مجدداً.");
      else if (errKey === "ambiguous") setError("هذا الرمز يطابق أكثر من طلب. يرجى التواصل مع التاجر للحصول على الرمز الكامل.");
      else if (errKey === "code_too_short") setError("الرمز قصير جداً. يجب أن يحتوي على 6 أحرف على الأقل (مثال: SL-1A2B3C).");
      else if (errKey === "invalid_code") setError("الرمز غير صحيح. تأكد من نسخه كاملاً دون تعديل.");
      else setError("لم نجد طلباً بهذا الرمز.");
    } else if (result) {
      setData(result as TrackResult);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialCode) doSearch(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(code);
  };

  const isReturned = data?.status === "returned";
  const isFailed = data?.status === "failed" || data?.status === "cancelled";
  const currentStage = data ? (STAGE_INDEX[data.status] ?? 0) : 0;
  const awaitingMerchant = data && !isReturned && !isFailed && currentStage === 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="font-display font-bold text-lg text-foreground leading-tight">صلة</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">تتبع طلبك بسهولة</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 items-center justify-center shadow-lg">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">تتبع طلبك</h2>
          <p className="text-muted-foreground text-sm">أدخل رمز صلة (Sila Code) كاملاً كما يظهر في صفحة الطلب</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
          placeholder="رمز الطلب (مثال: 1A2B3C4D)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 font-mono text-center tracking-wider uppercase"
            dir="ltr"
          />
          <Button type="submit" disabled={loading || !code.trim()} className="gap-2 px-5">
            <Search className="h-4 w-4" />
            {loading ? "..." : "تتبع"}
          </Button>
        </form>

        {/* Error */}
        {searched && !loading && error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {data && !error && (
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {/* Top status banner */}
              <div className={`p-5 border-b border-border ${
                data.status === "delivered" ? "bg-primary/10" :
                isReturned || isFailed ? "bg-destructive/10" :
                "bg-muted/30"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">رمز الطلب</p>
                    <p className="font-mono font-bold text-lg text-foreground">{data.sila_code}</p>
                  </div>
                  <Badge variant="outline" className={
                    data.status === "delivered" ? "bg-primary/20 text-primary border-primary/40" :
                    isReturned || isFailed ? "bg-destructive/20 text-destructive border-destructive/40" :
                    "bg-warning/20 text-warning border-warning/40"
                  }>
                    {data.status === "delivered" && <CheckCircle2 className="h-3 w-3 ml-1" />}
                    {STATUS_AR[data.status] || data.status}
                  </Badge>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Timeline / Stepper */}
                {!isReturned && !isFailed && (
                  <div className="pt-2 space-y-4">
                    {awaitingMerchant && (
                      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                        <Hourglass className="h-5 w-5 text-warning shrink-0 mt-0.5 animate-pulse" />
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-foreground">طلبك في انتظار تأكيد التاجر</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            سيتم تأكيد طلبك وتجهيزه قريباً من قِبَل التاجر، ثم سيُسلَّم إلى شركة الشحن. تابع هذه الصفحة لرؤية التحديثات.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between relative">
                      {/* Connector line behind dots */}
                      <div className="absolute top-5 right-0 left-0 h-0.5 bg-border mx-6" />
                      <div
                        className="absolute top-5 right-6 h-0.5 bg-primary transition-all"
                        style={{ width: `calc((100% - 3rem) * ${currentStage / (TIMELINE.length - 1)})` }}
                      />
                      {TIMELINE.map((stage, i) => {
                        const Icon = stage.icon;
                        const isDone = i < currentStage;
                        const isCurrent = i === currentStage;
                        return (
                          <div key={stage.key} className="flex flex-col items-center gap-1.5 relative z-10 flex-1">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                              isDone ? "bg-primary border-primary text-primary-foreground" :
                              isCurrent ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30 animate-pulse" :
                              "bg-card border-border text-muted-foreground"
                            }`}>
                              {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                            </div>
                            <span className={`text-[10px] text-center leading-tight px-0.5 ${
                              isCurrent ? "text-primary font-bold" :
                              isDone ? "text-foreground" :
                              "text-muted-foreground"
                            }`}>
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Returned banner */}
                {isReturned && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-1">
                    <p className="text-sm font-bold text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> تم إرجاع الطلب
                    </p>
                    {data.return_reason && (
                      <p className="text-xs text-muted-foreground pr-6">
                        السبب: <span className="text-foreground font-medium">{RETURN_REASON_AR[data.return_reason] || data.return_reason}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Details (privacy-safe) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">المحافظة</p>
                      <p className="font-medium text-foreground truncate">{CITY_AR[data.city] || data.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">رقم المستلم</p>
                      <p className="font-mono font-medium text-foreground" dir="ltr">{data.phone_masked}</p>
                    </div>
                  </div>
                  {data.courier_name && (
                    <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 sm:col-span-2">
                      <Truck className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">شركة الشحن</p>
                        <p className="font-medium text-foreground truncate">{data.courier_name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="pt-3 border-t border-border space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> تاريخ الإنشاء</span>
                    <span className="text-foreground">
                      {new Date(data.created_at).toLocaleDateString("ar")} —{" "}
                      {new Date(data.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> آخر تحديث</span>
                    <span className="text-foreground">
                      {new Date(data.updated_at).toLocaleDateString("ar")} —{" "}
                      {new Date(data.updated_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Privacy footer */}
        <p className="text-center text-[11px] text-muted-foreground pt-4">
          🔒 لحماية خصوصيتك، نعرض فقط المعلومات الأساسية لتتبع طلبك
        </p>
      </main>
    </div>
  );
}