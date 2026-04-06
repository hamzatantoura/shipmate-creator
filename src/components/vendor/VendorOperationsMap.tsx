import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, Loader2, Store, Banknote, Truck } from "lucide-react";
import { toast } from "sonner";
import { ALEPPO_MERCHANTS, type DemoMerchant } from "@/data/aleppo-demo-merchants";

interface Props {
  selectedMerchantId: string | null;
  onSelectMerchant: (id: string) => void;
  assignedIds: Set<string>;
  onAssign: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface NeighborhoodCluster {
  neighborhood: string;
  lat: number;
  lng: number;
  merchants: DemoMerchant[];
  totalPackages: number;
  totalValue: number;
  totalFees: number;
}

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
      box-shadow: 0 4px 14px -3px hsl(217 91% 60% / 0.45);
      border: 3px solid white;
      font-family: 'Readex Pro', sans-serif;
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createMerchantIcon = (selected = false) =>
  L.divIcon({
    html: `<div style="
      background: ${selected ? 'hsl(25, 100%, 50%)' : 'hsl(217, 91%, 60%)'};
      color: white;
      border-radius: 50%;
      width: ${selected ? 36 : 28}px;
      height: ${selected ? 36 : 28}px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px ${selected ? 'hsl(25 100% 50% / 0.5)' : 'hsl(217 91% 60% / 0.4)'};
      border: ${selected ? '3px' : '2px'} solid white;
      transition: all 0.2s;
    "><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg></div>`,
    className: "",
    iconSize: [selected ? 36 : 28, selected ? 36 : 28],
    iconAnchor: [selected ? 18 : 14, selected ? 18 : 14],
  });

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FlyToSelected({ merchant }: { merchant: DemoMerchant | null }) {
  const map = useMap();
  useEffect(() => {
    if (merchant) {
      map.flyTo([merchant.lat, merchant.lng], 16, { duration: 0.8 });
    }
  }, [merchant, map]);
  return null;
}

function FitAleppo() {
  const map = useMap();
  useEffect(() => { map.setView([36.2021, 37.1343], 13); }, [map]);
  return null;
}

function MerchantPopupContent({ merchant, onAssign, assigning }: {
  merchant: DemoMerchant;
  onAssign: (id: string) => void;
  assigning: boolean;
}) {
  return (
    <div className="font-sans min-w-[250px]" dir="rtl" style={{ fontFamily: "'Readex Pro', sans-serif" }}>
      <div className="bg-[hsl(222,47%,11%)] text-white rounded-t-lg px-4 py-3 -mx-[20px] -mt-[15px] mb-3" style={{ marginLeft: '-20px', marginRight: '-20px', marginTop: '-15px' }}>
        <h3 className="font-bold text-sm">{merchant.name}</h3>
        <span className="text-[11px] opacity-70">{merchant.neighborhood} — حلب</span>
      </div>
      <div className="space-y-2 px-1">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">عدد الطرود</span>
          <span className="font-bold text-[hsl(222,47%,11%)]">{merchant.packages}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">قيمة البضائع</span>
          <span className="font-bold text-[hsl(222,47%,11%)]">{merchant.productValue.toLocaleString()} ل.س</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">أجور الشحن</span>
          <span className="font-bold text-[hsl(217,91%,60%)]">{merchant.shippingFee.toLocaleString()} ل.س</span>
        </div>
        <div className="border-t pt-2 mt-2">
          <button
            className="w-full text-white text-sm py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{ background: 'hsl(217, 91%, 60%)' }}
            disabled={assigning}
            onClick={() => onAssign(merchant.id)}
          >
            {assigning ? "جارٍ التعيين..." : "تعيين لمندوب"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorOperationsMap({ selectedMerchantId, onSelectMerchant, assignedIds, onAssign }: Props) {
  const { user } = useAuth();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const markerRefs = useRef<Record<string, L.Marker>>({}); 

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      await supabase.from("couriers").select("*").eq("vendor_id", user.id).eq("is_active", true);
      setLoading(false);
    };
    load();
  }, [user]);

  const activeMerchants = useMemo(
    () => ALEPPO_MERCHANTS.filter(m => !assignedIds.has(m.id)),
    [assignedIds]
  );

  const selectedMerchant = useMemo(
    () => activeMerchants.find(m => m.id === selectedMerchantId) || null,
    [activeMerchants, selectedMerchantId]
  );

  // Open popup for selected merchant
  useEffect(() => {
    if (selectedMerchantId && markerRefs.current[selectedMerchantId]) {
      setTimeout(() => markerRefs.current[selectedMerchantId]?.openPopup(), 900);
    }
  }, [selectedMerchantId]);

  const clusters = useMemo<NeighborhoodCluster[]>(() => {
    const map: Record<string, DemoMerchant[]> = {};
    activeMerchants.forEach(m => {
      if (!map[m.neighborhood]) map[m.neighborhood] = [];
      map[m.neighborhood].push(m);
    });
    return Object.entries(map).map(([hood, merchants]) => ({
      neighborhood: hood,
      lat: merchants.reduce((s, m) => s + m.lat, 0) / merchants.length,
      lng: merchants.reduce((s, m) => s + m.lng, 0) / merchants.length,
      merchants,
      totalPackages: merchants.reduce((s, m) => s + m.packages, 0),
      totalValue: merchants.reduce((s, m) => s + m.productValue, 0),
      totalFees: merchants.reduce((s, m) => s + m.shippingFee, 0),
    }));
  }, [activeMerchants]);

  const handleAssign = (merchantId: string) => {
    setAssigning(merchantId);
    setTimeout(() => {
      onAssign(prev => new Set([...prev, merchantId]));
      toast.success("تم تعيين الشحنة للمندوب بنجاح");
      setAssigning(null);
    }, 800);
  };

  const totalPackages = activeMerchants.reduce((s, m) => s + m.packages, 0);
  const totalValue = activeMerchants.reduce((s, m) => s + m.productValue, 0);
  const totalFees = activeMerchants.reduce((s, m) => s + m.shippingFee, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Store, label: "نقاط الاستلام", value: activeMerchants.length.toString(), color: false },
          { icon: Package, label: "إجمالي الطرود", value: totalPackages.toString(), color: false },
          { icon: Banknote, label: "قيمة البضائع", value: `${totalValue.toLocaleString()} ل.س`, color: true },
          { icon: Truck, label: "أجور الشحن", value: `${totalFees.toLocaleString()} ل.س`, color: true },
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-lg font-display font-bold ${stat.color ? 'text-primary' : 'text-foreground'}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            غرفة عمليات حلب — بث مباشر
            <Badge variant="outline" className="mr-auto text-[10px] border-primary/30 text-primary">LIVE</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] w-full">
            <MapContainer
              center={[36.2021, 37.1343]}
              zoom={13}
              style={{ height: "100%", width: "100%", borderRadius: "0 0 0.75rem 0.75rem" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitAleppo />
              <FlyToSelected merchant={selectedMerchant} />

              {activeMerchants.map(merchant => (
                <Marker
                  key={merchant.id}
                  position={[merchant.lat, merchant.lng]}
                  icon={createMerchantIcon(merchant.id === selectedMerchantId)}
                  ref={(ref) => { if (ref) markerRefs.current[merchant.id] = ref; }}
                  eventHandlers={{
                    click: () => onSelectMerchant(merchant.id),
                  }}
                >
                  <Popup minWidth={260} maxWidth={300}>
                    <MerchantPopupContent
                      merchant={merchant}
                      onAssign={handleAssign}
                      assigning={assigning === merchant.id}
                    />
                  </Popup>
                </Marker>
              ))}

              {clusters.filter(c => c.merchants.length > 1).map(cluster => (
                <Marker
                  key={cluster.neighborhood}
                  position={[cluster.lat, cluster.lng]}
                  icon={createClusterIcon(cluster.totalPackages)}
                />
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Neighborhood summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clusters.map(cluster => (
          <Card key={cluster.neighborhood} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-foreground">{cluster.neighborhood}</h3>
                <Badge variant="secondary" className="text-[10px]">{cluster.merchants.length} متجر</Badge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>الطرود</span>
                  <span className="font-medium text-foreground">{cluster.totalPackages}</span>
                </div>
                <div className="flex justify-between">
                  <span>القيمة</span>
                  <span className="font-medium text-foreground">{cluster.totalValue.toLocaleString()} ل.س</span>
                </div>
                <div className="flex justify-between">
                  <span>أجور الشحن</span>
                  <span className="font-medium text-primary">{cluster.totalFees.toLocaleString()} ل.س</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
