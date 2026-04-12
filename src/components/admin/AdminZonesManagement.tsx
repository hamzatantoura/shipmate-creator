import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Loader2, Search } from "lucide-react";

interface ShippingZone {
  id: string;
  province_name: string;
  province_name_ar: string;
  area_name: string | null;
  area_name_ar: string | null;
  neighborhood_name: string | null;
  neighborhood_name_ar: string | null;
  delivery_fee: number;
  carrier_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Carrier {
  id: string;
  name: string;
  name_ar: string;
}

const EMPTY_FORM = {
  province_name: "",
  province_name_ar: "",
  area_name: "",
  area_name_ar: "",
  neighborhood_name: "",
  neighborhood_name_ar: "",
  delivery_fee: "",
  carrier_id: "",
  is_active: true,
};

export default function AdminZonesManagement() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [filterProvince, setFilterProvince] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    const [zRes, cRes] = await Promise.all([
      supabase.from("shipping_zones").select("*").order("province_name_ar").order("area_name_ar").order("neighborhood_name_ar"),
      supabase.from("carriers").select("id, name, name_ar").eq("is_active", true),
    ]);
    if (zRes.data) setZones(zRes.data as any);
    if (cRes.data) setCarriers(cRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const provinces = [...new Set(zones.map(z => z.province_name_ar))].sort();

  const filteredZones = zones.filter(z => {
    const matchSearch = !search || 
      z.province_name_ar.includes(search) || 
      z.area_name_ar?.includes(search) || 
      z.neighborhood_name_ar?.includes(search) ||
      z.province_name.toLowerCase().includes(search.toLowerCase());
    const matchProvince = filterProvince === "all" || z.province_name_ar === filterProvince;
    return matchSearch && matchProvince;
  });

  const openAdd = () => {
    setEditingZone(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (zone: ShippingZone) => {
    setEditingZone(zone);
    setForm({
      province_name: zone.province_name,
      province_name_ar: zone.province_name_ar,
      area_name: zone.area_name || "",
      area_name_ar: zone.area_name_ar || "",
      neighborhood_name: zone.neighborhood_name || "",
      neighborhood_name_ar: zone.neighborhood_name_ar || "",
      delivery_fee: String(zone.delivery_fee),
      carrier_id: zone.carrier_id || "",
      is_active: zone.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.province_name || !form.province_name_ar) {
      toast.error("اسم المحافظة مطلوب (عربي + إنجليزي)");
      return;
    }
    if (!form.delivery_fee || isNaN(Number(form.delivery_fee))) {
      toast.error("الرجاء إدخال سعر شحن صحيح");
      return;
    }

    setSaving(true);
    const payload = {
      province_name: form.province_name.trim(),
      province_name_ar: form.province_name_ar.trim(),
      area_name: form.area_name.trim() || null,
      area_name_ar: form.area_name_ar.trim() || null,
      neighborhood_name: form.neighborhood_name.trim() || null,
      neighborhood_name_ar: form.neighborhood_name_ar.trim() || null,
      delivery_fee: Number(form.delivery_fee),
      carrier_id: form.carrier_id || null,
      is_active: form.is_active,
    };

    if (editingZone) {
      const { error } = await supabase.from("shipping_zones").update(payload as any).eq("id", editingZone.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم تحديث المنطقة بنجاح");
    } else {
      const { error } = await supabase.from("shipping_zones").insert(payload as any);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("تم إضافة المنطقة بنجاح");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (zone: ShippingZone) => {
    if (!confirm(`حذف المنطقة: ${zone.province_name_ar} ${zone.area_name_ar || ""} ${zone.neighborhood_name_ar || ""}?`)) return;
    const { error } = await supabase.from("shipping_zones").delete().eq("id", zone.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف المنطقة");
    fetchData();
  };

  const toggleActive = async (zone: ShippingZone) => {
    await supabase.from("shipping_zones").update({ is_active: !zone.is_active } as any).eq("id", zone.id);
    fetchData();
  };

  const getZoneLabel = (z: ShippingZone) => {
    const parts = [z.province_name_ar];
    if (z.area_name_ar) parts.push(z.area_name_ar);
    if (z.neighborhood_name_ar) parts.push(z.neighborhood_name_ar);
    return parts.join(" → ");
  };

  const getLevel = (z: ShippingZone) => {
    if (z.neighborhood_name) return "حي";
    if (z.area_name) return "منطقة";
    return "محافظة";
  };

  const levelColor = (z: ShippingZone) => {
    if (z.neighborhood_name) return "bg-info/20 text-info border-info/30";
    if (z.area_name) return "bg-warning/20 text-warning border-warning/30";
    return "bg-primary/20 text-primary border-primary/30";
  };

  const carrierName = (id: string | null) => {
    if (!id) return "—";
    return carriers.find(c => c.id === id)?.name_ar || "—";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-display font-semibold text-foreground">إدارة مناطق الشحن</h2>
          <Badge variant="outline" className="text-xs">{zones.length} منطقة</Badge>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" /> إضافة منطقة
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filterProvince} onValueChange={setFilterProvince}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل المحافظات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المحافظات</SelectItem>
            {provinces.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredZones.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            {zones.length === 0 ? "لا توجد مناطق بعد. ابدأ بإضافة المحافظات والمناطق." : "لا توجد نتائج للبحث"}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المنطقة</TableHead>
                <TableHead className="text-right">المستوى</TableHead>
                <TableHead className="text-right">سعر الشحن</TableHead>
                <TableHead className="text-right">شركة الشحن</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredZones.map(z => (
                <TableRow key={z.id} className={!z.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{getZoneLabel(z)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={levelColor(z)}>{getLevel(z)}</Badge>
                  </TableCell>
                  <TableCell className="font-display font-bold">{Number(z.delivery_fee).toLocaleString()} ل.س</TableCell>
                  <TableCell className="text-sm">{carrierName(z.carrier_id)}</TableCell>
                  <TableCell>
                    <Switch checked={z.is_active} onCheckedChange={() => toggleActive(z)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(z)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(z)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingZone ? "تعديل منطقة" : "إضافة منطقة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              أضف محافظة فقط، أو محافظة + منطقة، أو محافظة + منطقة + حي. كل مستوى له سعر شحن خاص.
            </p>

            {/* Province */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المحافظة (عربي) <span className="text-destructive">*</span></Label>
                <Input value={form.province_name_ar} onChange={e => setForm({ ...form, province_name_ar: e.target.value })} placeholder="مثال: دمشق" />
              </div>
              <div className="space-y-1.5">
                <Label>المحافظة (إنجليزي) <span className="text-destructive">*</span></Label>
                <Input value={form.province_name} onChange={e => setForm({ ...form, province_name: e.target.value })} placeholder="e.g. Damascus" dir="ltr" />
              </div>
            </div>

            {/* Area */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المنطقة / المدينة (عربي)</Label>
                <Input value={form.area_name_ar} onChange={e => setForm({ ...form, area_name_ar: e.target.value })} placeholder="مثال: المزة" />
              </div>
              <div className="space-y-1.5">
                <Label>المنطقة (إنجليزي)</Label>
                <Input value={form.area_name} onChange={e => setForm({ ...form, area_name: e.target.value })} placeholder="e.g. Mezzeh" dir="ltr" />
              </div>
            </div>

            {/* Neighborhood */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الحي (عربي)</Label>
                <Input value={form.neighborhood_name_ar} onChange={e => setForm({ ...form, neighborhood_name_ar: e.target.value })} placeholder="مثال: المزة 86" />
              </div>
              <div className="space-y-1.5">
                <Label>الحي (إنجليزي)</Label>
                <Input value={form.neighborhood_name} onChange={e => setForm({ ...form, neighborhood_name: e.target.value })} placeholder="e.g. Mezzeh 86" dir="ltr" />
              </div>
            </div>

            {/* Price + Carrier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>سعر الشحن (ل.س) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })} placeholder="15000" />
              </div>
              <div className="space-y-1.5">
                <Label>شركة الشحن</Label>
                <Select value={form.carrier_id} onValueChange={v => setForm({ ...form, carrier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر شركة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون تعيين</SelectItem>
                    {carriers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>المنطقة مفعّلة</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {editingZone ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
