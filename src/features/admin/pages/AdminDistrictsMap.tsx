import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SilaMap, type SilaMarker } from "@/shared/components/maps/SilaMap";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Crosshair, Check, X } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/shared/components/layout/AppHeader";

interface DistrictRow {
  id: string; name: string; province_ar: string;
  lat: number | null; lng: number | null;
}

export default function AdminDistrictsMap() {
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("districts")
      .select("id, name, province_ar, lat, lng")
      .order("province_ar")
      .order("name");
    setDistricts((data || []) as DistrictRow[]);
  };

  useEffect(() => { load(); }, []);

  const withCoords = useMemo(() => districts.filter(d => d.lat != null && d.lng != null), [districts]);
  const missing = useMemo(() => {
    const list = districts.filter(d => d.lat == null || d.lng == null);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(d => d.name.toLowerCase().includes(q) || d.province_ar.toLowerCase().includes(q));
  }, [districts, search]);

  const markers: SilaMarker[] = withCoords.map(d => ({
    id: d.id,
    lat: d.lat as number,
    lng: d.lng as number,
    color: "hsl(199, 89%, 48%)",
    popup: (
      <div className="text-right space-y-1 min-w-[140px]">
        <p className="font-bold text-foreground">{d.name}</p>
        <p className="text-xs text-muted-foreground">{d.province_ar}</p>
      </div>
    ),
  }));

  // Pending marker (orange) for the click-to-set flow
  if (pendingId && pendingCoords) {
    markers.push({
      id: "pending",
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      color: "hsl(28, 100%, 50%)",
      popup: <div className="text-right text-xs">موقع مؤقت — اضغط حفظ لتثبيته</div>,
    });
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (!pendingId) {
      toast.info("اختر حياً أولاً من القائمة الجانبية");
      return;
    }
    setPendingCoords({ lat, lng });
  };

  const save = async () => {
    if (!pendingId || !pendingCoords) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_district_coords" as any, {
      p_district_id: pendingId,
      p_lat: pendingCoords.lat,
      p_lng: pendingCoords.lng,
    });
    setSaving(false);
    if (error) { toast.error("فشل الحفظ: " + error.message); return; }
    toast.success("تم حفظ الإحداثيات ✓");
    setPendingId(null);
    setPendingCoords(null);
    await load();
  };

  const cancel = () => { setPendingId(null); setPendingCoords(null); };

  const pendingDistrict = districts.find(d => d.id === pendingId);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Crosshair className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-foreground">إثراء إحداثيات الأحياء</h1>
            <p className="text-sm text-muted-foreground">اختر حياً ثم اضغط على الخريطة لتحديد موقعه — يحسّن دقة التوجيه الذكي</p>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-info/10 text-info border-info/30">{withCoords.length} محدد</Badge>
            <Badge variant="outline">{districts.length - withCoords.length} متبقي</Badge>
          </div>
        </div>

        {pendingDistrict && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <MapPin className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-bold text-foreground">{pendingDistrict.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pendingDistrict.province_ar}
                  {pendingCoords ? ` — ${pendingCoords.lat.toFixed(5)}, ${pendingCoords.lng.toFixed(5)}` : " — اضغط على الخريطة"}
                </p>
              </div>
              <Button size="sm" onClick={save} disabled={!pendingCoords || saving} className="gap-1.5">
                <Check className="h-4 w-4" /> حفظ
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} className="gap-1.5">
                <X className="h-4 w-4" /> إلغاء
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <SilaMap markers={markers} height={620} fitToMarkers={false} center={[34.8, 38.9]} zoom={7} onMapClick={handleMapClick} />

          <Card>
            <CardContent className="p-3 space-y-2">
              <Input placeholder="ابحث عن حي..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
              <p className="text-xs text-muted-foreground">{missing.length} حي بدون إحداثيات</p>
              <ScrollArea className="h-[520px] pr-1">
                <div className="space-y-1">
                  {missing.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setPendingId(d.id); setPendingCoords(null); }}
                      className={`w-full text-right p-2 rounded-lg border transition-colors text-sm ${
                        pendingId === d.id
                          ? "bg-primary/10 border-primary/40 text-foreground"
                          : "bg-card border-border hover:border-primary/30 text-foreground"
                      }`}
                    >
                      <p className="font-medium">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">{d.province_ar}</p>
                    </button>
                  ))}
                  {missing.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">كل الأحياء محددة 🎉</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}