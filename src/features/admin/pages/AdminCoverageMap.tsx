import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SilaMap, type SilaMarker } from "@/shared/components/maps/SilaMap";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Truck } from "lucide-react";
import AppHeader from "@/shared/components/layout/AppHeader";

interface BranchRow {
  id: string; name: string; phone: string | null;
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

  useEffect(() => {
    (async () => {
      const [{ data: br }, { data: co }, { data: pv }] = await Promise.all([
        supabase.from("courier_branches").select("id, name, phone, lat, lng, courier_id, province_id, is_active"),
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

  const markers: SilaMarker[] = filtered.map(b => ({
    id: b.id,
    lat: b.lat as number,
    lng: b.lng as number,
    color: b.is_active ? "hsl(28, 100%, 50%)" : "hsl(0, 0%, 50%)",
    popup: (
      <div className="text-right space-y-1 min-w-[160px]">
        <p className="font-bold text-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{b.name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Truck className="h-3 w-3" />{courierMap[b.courier_id] || "—"}</p>
        {b.province_id && <p className="text-xs text-muted-foreground">{provinceMap[b.province_id]}</p>}
        {b.phone && <p className="text-xs" dir="ltr">{b.phone}</p>}
      </div>
    ),
  }));

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
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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
            <div className="flex items-center gap-2">
              <Switch id="active" checked={activeOnly} onCheckedChange={setActiveOnly} />
              <Label htmlFor="active" className="text-sm">النشطة فقط</Label>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                {filtered.length} فرع
              </Badge>
              <Badge variant="outline">{coveredProvinces} محافظة</Badge>
            </div>
          </CardContent>
        </Card>

        <SilaMap markers={markers} height={600} />
      </main>
    </div>
  );
}