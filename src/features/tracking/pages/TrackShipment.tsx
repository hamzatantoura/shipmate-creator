import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Search, Package, MapPin, Truck, ArrowRight, RefreshCw } from "lucide-react";
import { MapPlaceholder } from "../components/MapPlaceholder";
import { ShipmentTimeline } from "../components/ShipmentTimeline";
import { EtaBanner } from "../components/EtaBanner";
import { DeliveryHistoryList } from "../components/DeliveryHistoryList";
import {
  STATUS_AR, CITY_AR, statusColor, buildTimeline, IN_TRANSIT_STATUSES,
  type StatusLog, type TimelineStep,
} from "../lib/tracking-utils";

interface ShipmentPublic {
  tracking_number: string;
  status: string;
  city: string;
  created_at: string;
  updated_at: string;
}

const POLL_MS = 20_000;

export default function TrackShipment() {
  const navigate = useNavigate();
  const { trackingId } = useParams();
  const [query, setQuery] = useState(trackingId || "");
  const [shipment, setShipment] = useState<ShipmentPublic | null>(null);
  const [history, setHistory] = useState<StatusLog[]>([]);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const activeTrackingRef = useRef<string | null>(null);

  const doSearch = useCallback(async (trackingNum: string, silent = false) => {
    const num = trackingNum.trim();
    if (!num) return;
    activeTrackingRef.current = num;
    if (silent) setRefreshing(true); else { setLoading(true); setSearched(true); }

    const { data } = await supabase.rpc("track_shipment_public", { p_tracking_number: num });
    if (data) {
      const d = data as any;
      setShipment({
        tracking_number: d.tracking_number,
        status: d.status,
        city: d.city,
        created_at: d.created_at,
        updated_at: d.updated_at,
      });
      setHistory((d.history || []).map((h: any, i: number) => ({ id: String(i), ...h })));
      setCarrier(d.carrier_name ?? null);
    } else if (!silent) {
      setShipment(null);
      setHistory([]);
      setCarrier(null);
    }
    setLastSync(new Date());
    if (silent) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => {
    if (trackingId) doSearch(trackingId);
  }, [trackingId, doSearch]);

  // Live polling while shipment is in transit
  useEffect(() => {
    if (!shipment) return;
    const isLive = IN_TRANSIT_STATUSES.has(shipment.status);
    if (!isLive) return;
    const id = setInterval(() => {
      if (activeTrackingRef.current) doSearch(activeTrackingRef.current, true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [shipment, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const timeline = useMemo<TimelineStep[]>(
    () => (shipment ? buildTimeline(shipment.status, history, shipment.created_at) : []),
    [shipment, history],
  );

  const isLive = !!shipment && IN_TRANSIT_STATUSES.has(shipment.status);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">صلة — تتبع الشحنة</span>
          {shipment && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-auto"
              onClick={() => activeTrackingRef.current && doSearch(activeTrackingRef.current, true)}
              disabled={refreshing}
              aria-label="تحديث"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                الرئيسية
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>تتبع الشحنة</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">تتبع شحنتك مباشرةً</h1>
          <p className="text-muted-foreground">أدخل رقم التتبع لمتابعة موقع شحنتك والوقت المتوقع للوصول</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="رقم التتبع (مثال: SIL-XXXXXX)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            dir="ltr"
          />
          <Button type="submit" disabled={loading} className="gap-2">
            <Search className="h-4 w-4" /> تتبع
          </Button>
        </form>

        {loading && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-5">
              <Skeleton className="h-56 w-full rounded-xl" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="space-y-5 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {searched && !loading && !shipment && (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على شحنة بهذا الرقم</p>
        )}

        {shipment && !loading && (
          <div className="space-y-5">
            {/* Map placeholder */}
            <MapPlaceholder
              city={CITY_AR[shipment.city] || shipment.city}
              isLive={isLive}
              courierName={carrier}
            />

            {/* Header card */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-mono text-sm text-muted-foreground truncate">
                      {shipment.tracking_number}
                    </span>
                  </div>
                  <Badge variant="outline" className={statusColor(shipment.status)}>
                    {STATUS_AR[shipment.status] || shipment.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{CITY_AR[shipment.city] || shipment.city}</span>
                  {carrier && (
                    <>
                      <span className="text-border">•</span>
                      <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{carrier}</span>
                    </>
                  )}
                </div>

                {lastSync && (
                  <p className="text-[11px] text-muted-foreground">
                    آخر مزامنة: {lastSync.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}
                    {isLive && <span className="text-success mr-2">• تحديث مباشر كل 20 ثانية</span>}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ETA */}
            <EtaBanner status={shipment.status} lastUpdate={shipment.updated_at} />

            {/* Timeline */}
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <ShipmentTimeline steps={timeline} />
              </CardContent>
            </Card>

            {/* Delivery history */}
            {history.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <DeliveryHistoryList history={history} />
                </CardContent>
              </Card>
            )}

            <p className="text-center text-[11px] text-muted-foreground pt-2">
              🔒 صفحة عامة تعرض المعلومات الأساسية فقط لحماية خصوصية المستلم
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
