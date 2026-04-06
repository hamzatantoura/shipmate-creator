import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Package, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Syrian city coordinates
const CITY_COORDS: Record<string, [number, number]> = {
  Damascus: [33.5138, 36.2765],
  Aleppo: [36.2021, 37.1343],
  Homs: [34.7324, 36.7137],
  Lattakia: [35.5317, 35.7900],
  Hama: [35.1318, 36.7516],
  Tartous: [34.8959, 35.8867],
};

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

interface ClusterData {
  city: string;
  lat: number;
  lng: number;
  shipments: any[];
  count: number;
}

// Custom cluster icon
const createClusterIcon = (count: number) => {
  const size = count > 10 ? 56 : count > 5 ? 48 : 40;
  return L.divIcon({
    html: `<div style="
      background: hsl(217, 91%, 60%);
      color: white;
      border-radius: 50%;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: ${count > 10 ? 16 : 14}px;
      box-shadow: 0 4px 14px -3px hsl(217 91% 60% / 0.5);
      border: 3px solid white;
      font-family: 'Inter', sans-serif;
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitBounds({ clusters }: { clusters: ClusterData[] }) {
  const map = useMap();
  useEffect(() => {
    if (clusters.length > 0) {
      const bounds = L.latLngBounds(clusters.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [clusters, map]);
  return null;
}

export default function VendorOperationsMap() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [shipmentsRes, couriersRes] = await Promise.all([
        supabase
          .from("shipments")
          .select("*")
          .in("status", ["pending", "pending_pickup", "at_warehouse"])
          .order("created_at", { ascending: false }),
        supabase
          .from("couriers")
          .select("*")
          .eq("vendor_id", user.id)
          .eq("is_active", true),
      ]);
      if (shipmentsRes.data) setShipments(shipmentsRes.data);
      if (couriersRes.data) setCouriers(couriersRes.data);
      setLoading(false);
    };
    load();
  }, [user]);

  // Cluster shipments by city
  const clusters = useMemo<ClusterData[]>(() => {
    const cityMap: Record<string, any[]> = {};
    shipments.forEach(s => {
      const city = s.city;
      if (!cityMap[city]) cityMap[city] = [];
      cityMap[city].push(s);
    });
    return Object.entries(cityMap)
      .filter(([city]) => CITY_COORDS[city])
      .map(([city, items]) => ({
        city,
        lat: CITY_COORDS[city][0],
        lng: CITY_COORDS[city][1],
        shipments: items,
        count: items.length,
      }));
  }, [shipments]);

  const assignCourier = async (shipmentId: string, city: string) => {
    const courierId = selectedCourier[city];
    if (!courierId) {
      toast.error("اختر مندوباً أولاً");
      return;
    }
    setAssigning(shipmentId);
    const { error } = await supabase
      .from("shipments")
      .update({ courier_id: courierId, status: "with_distributor" } as any)
      .eq("id", shipmentId);
    if (error) {
      toast.error("فشل التعيين");
    } else {
      toast.success("تم تعيين المندوب بنجاح");
      setShipments(prev => prev.filter(s => s.id !== shipmentId));
    }
    setAssigning(null);
  };

  const assignAllInCity = async (cluster: ClusterData) => {
    const courierId = selectedCourier[cluster.city];
    if (!courierId) {
      toast.error("اختر مندوباً أولاً");
      return;
    }
    setAssigning(cluster.city);
    const ids = cluster.shipments.map(s => s.id);
    const { error } = await supabase
      .from("shipments")
      .update({ courier_id: courierId, status: "with_distributor" } as any)
      .in("id", ids);
    if (error) {
      toast.error("فشل التعيين الجماعي");
    } else {
      toast.success(`تم تعيين ${ids.length} شحنة للمندوب`);
      setShipments(prev => prev.filter(s => !ids.includes(s.id)));
    }
    setAssigning(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">بانتظار الاستلام</p>
              <p className="text-lg font-display font-bold text-foreground">{shipments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مدن نشطة</p>
              <p className="text-lg font-display font-bold text-foreground">{clusters.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المناديب</p>
              <p className="text-lg font-display font-bold text-foreground">{couriers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي COD</p>
              <p className="text-lg font-display font-bold text-primary">
                {shipments.reduce((s, sh) => s + Number(sh.cod_amount), 0).toLocaleString()} ل.س
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            خريطة العمليات المباشرة
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[450px] w-full">
            <MapContainer
              center={[34.8, 36.5]}
              zoom={7}
              style={{ height: "100%", width: "100%", borderRadius: "0 0 0.75rem 0.75rem" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds clusters={clusters} />
              {clusters.map(cluster => (
                <Marker
                  key={cluster.city}
                  position={[cluster.lat, cluster.lng]}
                  icon={createClusterIcon(cluster.count)}
                >
                  <Popup minWidth={280} maxWidth={320}>
                    <div className="font-sans text-right" dir="rtl" style={{ fontFamily: "'Readex Pro', sans-serif" }}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-base">{CITY_AR[cluster.city] || cluster.city}</h3>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {cluster.count} شحنة
                        </span>
                      </div>

                      {couriers.length > 0 && (
                        <div className="space-y-2 border-t pt-2">
                          <label className="text-xs text-gray-500">تعيين مندوب:</label>
                          <select
                            className="w-full text-sm border rounded-md px-2 py-1.5"
                            value={selectedCourier[cluster.city] || ""}
                            onChange={e => setSelectedCourier(prev => ({ ...prev, [cluster.city]: e.target.value }))}
                          >
                            <option value="">اختر مندوب...</option>
                            {couriers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 rounded-md transition-colors disabled:opacity-50"
                            disabled={!selectedCourier[cluster.city] || assigning === cluster.city}
                            onClick={() => assignAllInCity(cluster)}
                          >
                            {assigning === cluster.city ? "جارٍ التعيين..." : `تعيين الكل (${cluster.count} شحنة)`}
                          </button>
                        </div>
                      )}

                      <div className="mt-2 border-t pt-2 max-h-40 overflow-y-auto space-y-1.5">
                        {cluster.shipments.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                            <div>
                              <span className="font-medium">{s.receiver_name}</span>
                              <span className="text-gray-400 mr-1">({Number(s.cod_amount).toLocaleString()} ل.س)</span>
                            </div>
                            {couriers.length > 0 && selectedCourier[cluster.city] && (
                              <button
                                className="text-blue-500 hover:text-blue-700 text-[10px] font-medium"
                                disabled={assigning === s.id}
                                onClick={() => assignCourier(s.id, cluster.city)}
                              >
                                تعيين
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {couriers.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <UserCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لم تضف مناديب بعد. أضف مناديبك من تبويب "المناديب" لتتمكن من تعيين الشحنات.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
