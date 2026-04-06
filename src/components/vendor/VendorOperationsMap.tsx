import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, UserCheck, Loader2, Store, Banknote, Truck } from "lucide-react";
import { toast } from "sonner";

// Aleppo neighborhood coordinates (real locations)
const ALEPPO_MERCHANTS = [
  { id: "demo-1", name: "أزياء السلطان", neighborhood: "الفرقان", lat: 36.1950, lng: 37.1480, packages: 5, productValue: 1250000, shippingFee: 35000 },
  { id: "demo-2", name: "إلكترونيات الشهباء", neighborhood: "الشهباء", lat: 36.2280, lng: 37.1200, packages: 8, productValue: 3200000, shippingFee: 55000 },
  { id: "demo-3", name: "مكتبة الفرقان", neighborhood: "الفرقان", lat: 36.1970, lng: 37.1520, packages: 3, productValue: 450000, shippingFee: 20000 },
  { id: "demo-4", name: "حلويات السعد", neighborhood: "الموكامبو", lat: 36.2100, lng: 37.1350, packages: 2, productValue: 680000, shippingFee: 18000 },
  { id: "demo-5", name: "عطور الشرق", neighborhood: "المحافظة", lat: 36.2150, lng: 37.1600, packages: 4, productValue: 920000, shippingFee: 28000 },
  { id: "demo-6", name: "موبايلات الجميلية", neighborhood: "الجميلية", lat: 36.2030, lng: 37.1550, packages: 7, productValue: 4500000, shippingFee: 48000 },
  { id: "demo-7", name: "أحذية الأناقة", neighborhood: "الجميلية", lat: 36.2045, lng: 37.1570, packages: 3, productValue: 750000, shippingFee: 22000 },
  { id: "demo-8", name: "سوبر ماركت النجمة", neighborhood: "السريان", lat: 36.2080, lng: 37.1480, packages: 6, productValue: 1800000, shippingFee: 42000 },
  { id: "demo-9", name: "مفروشات الديار", neighborhood: "حلب الجديدة", lat: 36.1880, lng: 37.1300, packages: 2, productValue: 5200000, shippingFee: 65000 },
  { id: "demo-10", name: "صيدلية الشفاء", neighborhood: "الحمدانية", lat: 36.1750, lng: 37.1100, packages: 4, productValue: 380000, shippingFee: 25000 },
  { id: "demo-11", name: "ملابس أطفال ليلى", neighborhood: "الحمدانية", lat: 36.1770, lng: 37.1130, packages: 5, productValue: 620000, shippingFee: 30000 },
  { id: "demo-12", name: "معرض الأمل للأجهزة", neighborhood: "الشهباء", lat: 36.2260, lng: 37.1230, packages: 1, productValue: 2100000, shippingFee: 15000 },
  { id: "demo-13", name: "بوتيك ورد", neighborhood: "المحافظة", lat: 36.2170, lng: 37.1580, packages: 6, productValue: 1450000, shippingFee: 38000 },
  { id: "demo-14", name: "مطعم بيت جدي", neighborhood: "الموكامبو", lat: 36.2115, lng: 37.1370, packages: 3, productValue: 520000, shippingFee: 20000 },
  { id: "demo-15", name: "قرطاسية النور", neighborhood: "السريان", lat: 36.2065, lng: 37.1500, packages: 2, productValue: 180000, shippingFee: 12000 },
];

interface NeighborhoodCluster {
  neighborhood: string;
  lat: number;
  lng: number;
  merchants: typeof ALEPPO_MERCHANTS;
  totalPackages: number;
  totalValue: number;
  totalFees: number;
}

// Cluster icon matching design system
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

// Individual merchant pin
const createMerchantIcon = () =>
  L.divIcon({
    html: `<div style="
      background: hsl(217, 91%, 60%);
      color: white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px hsl(217 91% 60% / 0.4);
      border: 2px solid white;
    "><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitAleppo() {
  const map = useMap();
  useEffect(() => {
    map.setView([36.2021, 37.1343], 13);
  }, [map]);
  return null;
}

function MerchantPopupContent({ merchant, onAssign, assigning }: {
  merchant: typeof ALEPPO_MERCHANTS[0];
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

export default function VendorOperationsMap() {
  const { user } = useAuth();
  const [couriers, setCouriers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("couriers")
        .select("*")
        .eq("vendor_id", user.id)
        .eq("is_active", true);
      if (data) setCouriers(data);
      setLoading(false);
    };
    load();
  }, [user]);

  // Active (unassigned) merchants
  const activeMerchants = useMemo(
    () => ALEPPO_MERCHANTS.filter(m => !assignedIds.has(m.id)),
    [assignedIds]
  );

  // Cluster by neighborhood
  const clusters = useMemo<NeighborhoodCluster[]>(() => {
    const map: Record<string, typeof ALEPPO_MERCHANTS> = {};
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
      setAssignedIds(prev => new Set([...prev, merchantId]));
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
            <Badge variant="outline" className="mr-auto text-[10px] border-primary/30 text-primary">
              LIVE
            </Badge>
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

              {/* Individual merchant pins */}
              {activeMerchants.map(merchant => (
                <Marker
                  key={merchant.id}
                  position={[merchant.lat, merchant.lng]}
                  icon={createMerchantIcon()}
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

              {/* Neighborhood cluster markers (larger, shows aggregate) */}
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
