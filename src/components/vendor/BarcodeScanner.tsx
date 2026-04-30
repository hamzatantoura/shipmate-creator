import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanLine, X, CheckCircle, User, Phone, MapPin, Loader2, Truck, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];
type EnrichedShipment = Shipment & { courier_name?: string | null; branch_name?: string | null };
type OrderLookupMatch = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "shipment_id" | "receiver_name" | "phone_number" | "city" | "detailed_address" | "total_amount" | "status"
>;

const STATUS_OPTIONS = [
  { value: "picked_up", label: "تم الاستلام من التاجر" },
  { value: "at_warehouse", label: "في المستودع" },
  { value: "in_transit_intercity", label: "جاري الشحن بين المحافظات" },
  { value: "with_distributor", label: "مع مندوب التوزيع" },
  { value: "out_for_delivery", label: "جاري التوصيل" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
];

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  picked_up: "تم الاستلام",
  at_warehouse: "في المستودع",
  in_transit_intercity: "جاري الشحن",
  with_distributor: "مع التوزيع",
  out_for_delivery: "جاري التوصيل",
  delivered: "تم التسليم",
  returned: "مرتجع",
};

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

export default function BarcodeScanner() {
  const [scanning, setScanning] = useState(false);
  const [shipment, setShipment] = useState<EnrichedShipment | null>(null);
  const [orderMatch, setOrderMatch] = useState<OrderLookupMatch | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [updating, setUpdating] = useState(false);
  const [looking, setLooking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("barcode-scanner-" + Date.now());

  const startScanner = async () => {
    setShipment(null);
    setOrderMatch(null);
    setScanning(true);

    try {
      // Pre-flight check: in iframes (like the Lovable preview) the browser
      // often blocks camera access. Detect this clearly so the user knows
      // it's a permission/iframe issue, not a code bug.
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("المتصفح لا يدعم الوصول إلى الكاميرا. جرّب فتح التطبيق في تبويب جديد أو من رابط النشر.");
      }

      // Explicitly request permission first — gives a clearer error than html5-qrcode's generic failure
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        probe.getTracks().forEach((t) => t.stop());
      } catch (permErr: any) {
        const name = permErr?.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          throw new Error("تم رفض إذن الكاميرا. افتح إعدادات الموقع في المتصفح واسمح بالوصول للكاميرا، ثم أعد المحاولة.");
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          throw new Error("لم يتم العثور على كاميرا في هذا الجهاز.");
        }
        if (name === "NotReadableError" || name === "TrackStartError") {
          throw new Error("الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى ثم أعد المحاولة.");
        }
        if (name === "SecurityError" || (window.self !== window.top)) {
          throw new Error("الكاميرا محجوبة داخل المعاينة. اضغط 'Open in new tab' لفتح التطبيق في تبويب مستقل.");
        }
        throw new Error(permErr?.message || "تعذر الوصول إلى الكاميرا.");
      }

      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
          // Stop the camera in parallel — don't block the lookup waiting for it
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          setScanning(false);
          lookupShipment(decodedText);
        },
        () => {} // ignore scan errors
      );
    } catch (err: any) {
      toast.error(err?.message || "تعذر تشغيل الكاميرا. تحقق من صلاحيات الكاميرا.", { duration: 6000 });
      setScanning(false);
    }
  };

  const lookupShipment = async (rawCode: string) => {
    setShipment(null);
    setOrderMatch(null);

    const cleaned = (rawCode || "").trim();
    if (cleaned.length < 4) {
      toast.error(`الرمز قصير جداً: ${rawCode}`);
      return;
    }

    setLooking(true);
    try {
      // Single round-trip: indexed lookup + joins + RLS, all server-side.
      const { data, error } = await supabase.rpc("lookup_shipment_by_code", { code: cleaned });
      if (error) throw error;

      const row = (data && data.length > 0 ? data[0] : null) as EnrichedShipment | null;

      if (row) {
        setShipment(row);
        const nextStatus = getNextStatus(row.status);
        if (nextStatus) setNewStatus(nextStatus);
        toast.success(`تم العثور على الشحنة: ${row.tracking_number || cleaned}`);
      } else {
        toast.error(`لم يتم العثور على شحنة بالرمز: ${rawCode}`);
      }
    } catch (err: any) {
      toast.error(err.message || "تعذر البحث عن الشحنة");
    } finally {
      setLooking(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const getNextStatus = (current: string): string => {
    const flow = ["pending", "picked_up", "at_warehouse", "in_transit_intercity", "with_distributor", "out_for_delivery", "delivered"];
    const idx = flow.indexOf(current);
    if (idx >= 0 && idx < flow.length - 1) return flow[idx + 1];
    return "";
  };

  const updateStatus = async () => {
    if (!shipment || !newStatus) return;
    setUpdating(true);

    await supabase.from("shipment_status_history").insert({
      shipment_id: shipment.id,
      old_status: shipment.status,
      new_status: newStatus,
      changed_by: "vendor",
    } as any);

    const { error } = await supabase
      .from("shipments")
      .update({ status: newStatus })
      .eq("id", shipment.id);

    if (error) {
      toast.error(error.message);
    } else {
      // Sync linked order status so the merchant sees the update on their side
      const orderStatusMap: Record<string, string> = {
        picked_up: "processing",
        at_warehouse: "processing",
        in_transit_intercity: "in_transit",
        with_distributor: "in_transit",
        out_for_delivery: "out_for_delivery",
        delivered: "delivered",
        returned: "returned",
      };
      const mappedOrderStatus = orderStatusMap[newStatus];
      if (mappedOrderStatus) {
        await supabase
          .from("orders")
          .update({ status: mappedOrderStatus })
          .eq("shipment_id", shipment.id);
      }
      toast.success(`تم تحديث الحالة إلى: ${STATUS_AR[newStatus] || newStatus}`);
      setShipment({ ...shipment, status: newStatus });
      // Suggest next status
      const next = getNextStatus(newStatus);
      setNewStatus(next);
    }
    setUpdating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          مسح الباركود
        </h2>
        {!scanning ? (
          <Button onClick={startScanner} className="gap-2 glow-btn">
            <ScanLine className="h-4 w-4" /> تشغيل الماسح
          </Button>
        ) : (
          <Button variant="destructive" onClick={stopScanner} className="gap-2">
            <X className="h-4 w-4" /> إيقاف
          </Button>
        )}
      </div>

      {/* Scanner viewport */}
      {scanning && (
        <Card className="border-primary/30 overflow-hidden">
          <CardContent className="p-0">
            <div id={containerRef.current} className="w-full" style={{ minHeight: 280 }} />
            <p className="text-center text-xs text-muted-foreground py-2 animate-pulse">
              وجّه الكاميرا نحو باركود أو QR code الشحنة...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instant loading state while RPC is in flight */}
      {looking && !shipment && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            جارٍ البحث عن الشحنة...
          </CardContent>
        </Card>
      )}

      {/* Scanned shipment result */}
      {shipment && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-primary">{shipment.tracking_number}</span>
              <Badge variant="outline" className="text-xs">
                {STATUS_AR[shipment.status] || shipment.status}
              </Badge>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground font-medium">{shipment.receiver_name}</span></div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground" dir="ltr">{shipment.phone_number}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">{CITY_AR[shipment.city] || shipment.city} — {shipment.detailed_address}</span></div>
              {shipment.courier_name && (
                <div className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">شركة الشحن: <span className="font-medium">{shipment.courier_name}</span></span></div>
              )}
              <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">فرع الاستلام: <span className="font-medium">{shipment.branch_name || "توصيل للمنزل"}</span></span></div>
            </div>

            <div className="bg-background rounded-md p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">COD</span>
              <span className="font-display font-bold text-lg text-foreground">{Number(shipment.cod_amount).toLocaleString()} ل.س</span>
            </div>

            {/* Quick status update */}
            {shipment.status !== "delivered" && shipment.status !== "returned" && (
              <div className="flex gap-2">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="تغيير الحالة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.filter(o => o.value !== shipment.status).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!newStatus || updating}
                  onClick={updateStatus}
                  className="glow-btn gap-1"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  تحديث
                </Button>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => { setShipment(null); startScanner(); }}>
              <ScanLine className="h-4 w-4 ml-1" /> مسح شحنة أخرى
            </Button>
          </CardContent>
        </Card>
      )}

      {!scanning && !shipment && orderMatch && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-bold text-foreground">SL-{orderMatch.id.replace(/-/g, "").slice(0, 6).toUpperCase()}</span>
              <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                لا توجد شحنة بعد
              </Badge>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground font-medium">{orderMatch.receiver_name}</span></div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground" dir="ltr">{orderMatch.phone_number}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">{CITY_AR[orderMatch.city] || orderMatch.city} — {orderMatch.detailed_address}</span></div>
            </div>

            <p className="text-sm text-destructive font-medium">تم العثور على الطلب، لكن لم يتم إنشاء سجل شحنة مرتبط بهذا الرمز بعد.</p>

            <Button variant="outline" size="sm" className="w-full" onClick={() => { setOrderMatch(null); startScanner(); }}>
              <ScanLine className="h-4 w-4 ml-1" /> مسح شحنة أخرى
            </Button>
          </CardContent>
        </Card>
      )}

      {!scanning && !shipment && !orderMatch && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <ScanLine className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>اضغط "تشغيل الماسح" لمسح باركود الشحنة</p>
          <p className="text-xs mt-1">يمكنك مسح باركود Code128 أو QR code المطبوع على بوليصة الشحن</p>
        </div>
      )}
    </div>
  );
}
