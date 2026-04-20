import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MapPin, Loader2, Search, ArrowLeft, Info } from "lucide-react";
import { Link } from "react-router-dom";

interface ShippingZone {
  id: string;
  province_name_ar: string;
  area_name_ar: string | null;
  neighborhood_name_ar: string | null;
  delivery_fee: number;
  carrier_id: string | null;
  is_active: boolean;
}

interface Carrier { id: string; name_ar: string; }

export default function AdminZonesManagement() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProvince, setFilterProvince] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [zRes, cRes] = await Promise.all([
        supabase.from("shipping_zones").select("*").order("province_name_ar"),
        supabase.from("carriers").select("id, name_ar").eq("is_active", true),
      ]);
      if (zRes.data) setZones(zRes.data as any);
      if (cRes.data) setCarriers(cRes.data as any);
      setLoading(false);
    })();
  }, []);

  const provinces = [...new Set(zones.map(z => z.province_name_ar))].sort();
  const filtered = zones.filter(z => {
    const matchSearch = !search ||
      z.province_name_ar.includes(search) ||
      z.area_name_ar?.includes(search) ||
      z.neighborhood_name_ar?.includes(search);
    const matchProvince = filterProvince === "all" || z.province_name_ar === filterProvince;
    return matchSearch && matchProvince;
  });

  const carrierName = (id: string | null) =>
    !id ? "—" : carriers.find(c => c.id === id)?.name_ar || "—";

  const getZoneLabel = (z: ShippingZone) => {
    const parts = [z.province_name_ar];
    if (z.area_name_ar) parts.push(z.area_name_ar);
    if (z.neighborhood_name_ar) parts.push(z.neighborhood_name_ar);
    return parts.join(" → ");
  };

  return (
    <div className="space-y-4">
      {/* Redirect banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-foreground">
              <span className="font-bold">إدارة المحافظات والمناطق وأسعار الشحن</span> أصبحت موحّدة في صفحة <span className="font-bold">إدارة المناطق</span>. هذا التبويب يعرض السجل القديم للقراءة فقط.
            </p>
            <Link to="/admin/districts">
              <Button size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                الانتقال إلى إدارة المناطق
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">سجل المناطق القديم (قراءة فقط)</h2>
        <Badge variant="outline" className="text-xs">{zones.length}</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={filterProvince} onValueChange={setFilterProvince}>
          <SelectTrigger className="w-48"><SelectValue placeholder="كل المحافظات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المحافظات</SelectItem>
            {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            {zones.length === 0 ? "لا توجد سجلات قديمة." : "لا توجد نتائج للبحث"}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المنطقة</TableHead>
                <TableHead className="text-right">سعر الشحن</TableHead>
                <TableHead className="text-right">شركة الشحن</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(z => (
                <TableRow key={z.id} className={!z.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{getZoneLabel(z)}</TableCell>
                  <TableCell className="font-display font-bold">{Number(z.delivery_fee).toLocaleString()} ل.س</TableCell>
                  <TableCell className="text-sm">{carrierName(z.carrier_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={z.is_active ? "bg-primary/15 text-primary border-primary/30" : ""}>
                      {z.is_active ? "مفعّلة" : "موقوفة"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
