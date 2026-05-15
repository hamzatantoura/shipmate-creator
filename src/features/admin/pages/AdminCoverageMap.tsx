import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SilaMap, type SilaMarker, MARKER_COLORS, distanceKm } from "@/shared/components/maps/SilaMap";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Truck, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AppHeader from "@/shared/components/layout/AppHeader";

interface BranchRow {
  id: string; name: string; phone: string | null; address_details: string | null;
  lat: number | null; lng: number | null;
  courier_id: string; province_id: string | null; is_active: boolean;
}

export default function AdminCoverageMap() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [couriers, setCouriers] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ id: string; name_ar: string }[]>([]);
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number; label?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: br }, { data: co }, { data: pv }] = await Promise.all([
        supabase.from("courier_branches").select("id, name, phone, address_details, lat, lng, courier_id, province_id, is_active"),
        supabase.from("couriers").select("id, name").order("name"),
        supabase.from("provinces").select("id, name_ar").order("name_ar"),
      ]);
      setBranches((br || []) as BranchRow[]);
      setCouriers((co || []) as any);
      setProvinces((pv || []) as any);
    })();
  }, []);

  const courierMap = useMemo(() => Object.fromEntries(couriers.map(c => [c.id, c.name])), [couriers]);
  const provinceMap = useMemo(() => Object.fromEntries(provinces.map(p => [p.id, p.name_ar])), [provinces]);

  const filtered = useMemo(() => {
    return branches.filter(b => {
      if (b.lat == null || b.lng == null) return false;
      if (activeOnly && !b.is_active) return false;
      if (courierFilter !== "all" && b.courier_id !== courierFilter) return false;
      if (provinceFilter !== "all" && b.province_id !== provinceFilter) return false;
      return true;
    });
  }, [branches, activeOnly, courierFilter, provinceFilter]);

  const selectBranch = (b: BranchRow) => {
    setSelectedBranchId(b.id);
    toast.success(`تم اختيار: ${b.name}`);
  };

  const markers: SilaMarker[] = filtered.map(b => {
    const isSelected = b.id === selectedBranchId;
    const color = !b.is_active
      ? MARKER_COLORS.branchInactive
      : isSelected
        ? "#16a34a"
        : MARKER_COLORS.branch;
    const distance = customerLocation && b.lat != null && b.lng != null
      ? distanceKm(customerLocation, { lat: b.lat, lng: b.lng })
      : null;
    return {
      id: b.id,
      lat: b.lat as number,
      lng: b.lng as number,
      color,
      popup: (
        <div className="text-right space-y-2 min-w-[200px]">
          <p className="font-bold text-zinc-900 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />{b.name}
          </p>
          <p className="text-xs text-zinc-600 flex items-center gap-1.5">
            <Truck className="h-3 w-3" />{courierMap[b.courier_id] || "—"}
          </p>
          {b.address_details && (
            <p className="text-xs text-zinc-600 flex items-start gap-1.5">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{b.address_details}</span>
            </p>
          )}
          {b.province_id && (
            <p className="text-xs text-zinc-500">{provinceMap[b.province_id]}</p>
          )}
          {b.phone && (
            <p className="text-xs flex items-center gap-1.5 text-zinc-600" dir="ltr">
              <Phone className="h-3 w-3" />{b.phone}
            </p>
          )}
          {distance !== null && (
            <p className="text-xs font-semibold text-blue-600">
              المسافة من العميل: {distance.toFixed(1)} كم
            </p>
          )}
          <Button
            size="sm"
            className="w-full h-8 mt-1 gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs"
            onClick={() => selectBranch(b)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSelected ? "تم الاختيار" : "تحديد هذا الفرع"}
          </Button>
        </div>
      ),
    };
  });

  // Nearest branch to customer (used to draw the distance line)
  const nearestBranchId = useMemo(() => {
    if (!customerLocation) return undefined;
    let best: { id: string; km: number } | null = null;
    for (const b of filtered) {
      if (b.lat == null || b.lng == null) continue;
      const km = distanceKm(customerLocation, { lat: b.lat, lng: b.lng });
      if (!best || km < best.km) best = { id: b.id, km };
    }
    return best?.id;
  }, [customerLocation, filtered]);

  const coveredProvinces = new Set(filtered.map(b => b.province_id).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">خريطة تغطية الفروع</h1>
            <p className="text-sm text-muted-foreground">عرض جغرافي لجميع فروع شركات الشحن</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">شركة الشحن</Label>
                <Select value={courierFilter} onValueChange={setCourierFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">المحافظة</Label>
                <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40">
                <Switch id="active" checked={activeOnly} onCheckedChange={setActiveOnly} />
                <Label htmlFor="active" className="text-sm cursor-pointer">النشطة فقط</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                  {filtered.length} فرع
                </Badge>
                <Badge variant="outline">{coveredProvinces} محافظة</Badge>
                {customerLocation && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setCustomerLocation(null); setSelectedBranchId(null); }}
                  >
                    مسح موقع العميل
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              💡 انقر على الخريطة لتحديد موقع العميل، ستظهر المسافة إلى أقرب فرع تلقائياً.
            </p>
          </CardContent>
        </Card>

        <SilaMap
          markers={markers}
          height={600}
          tileStyle="positron"
          customerLocation={customerLocation || undefined}
          nearestBranchId={nearestBranchId}
          onMapClick={(lat, lng) => setCustomerLocation({ lat, lng, label: "موقع العميل" })}
        />
      </main>
    </div>
  );
}