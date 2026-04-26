import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, MapPin, Phone, Building2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LocationPicker from "@/components/LocationPicker";

interface Branch {
  id: string;
  courier_id: string;
  name: string;
  province_id: string | null;
  district_id: string | null;
  address_details: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  is_active: boolean;
}

interface CourierLite { id: string; name: string }
interface ProvinceLite { id: string; name_ar: string }
interface DistrictLite { id: string; name: string; parent_id: string | null; province_ar: string }

const emptyForm = {
  id: "" as string,
  courier_id: "",
  name: "",
  province_id: "",
  district_id: "",
  address_details: "",
  lat: null as number | null,
  lng: null as number | null,
  phone: "",
  is_active: true,
};

export default function AdminBranchesManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<CourierLite[]>([]);
  const [provinces, setProvinces] = useState<ProvinceLite[]>([]);
  const [districts, setDistricts] = useState<DistrictLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCourier, setFilterCourier] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const isEdit = !!form.id;

  const fetchAll = async () => {
    setLoading(true);
    const [bRes, cRes, pRes, dRes] = await Promise.all([
      supabase.from("courier_branches").select("*").order("created_at", { ascending: false }),
      supabase.from("couriers").select("id, name").order("name"),
      supabase.from("provinces").select("id, name_ar").order("name_ar"),
      supabase.from("districts").select("id, name, parent_id, province_ar").order("name"),
    ]);
    if (bRes.data) setBranches(bRes.data as Branch[]);
    if (cRes.data) setCouriers(cRes.data as CourierLite[]);
    if (pRes.data) setProvinces(pRes.data as ProvinceLite[]);
    if (dRes.data) setDistricts(dRes.data as DistrictLite[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const courierName = (id: string) => couriers.find(c => c.id === id)?.name || "—";
  const provinceName = (id: string | null) => id ? (provinces.find(p => p.id === id)?.name_ar || "—") : "—";
  const districtName = (id: string | null) => id ? (districts.find(d => d.id === id)?.name || "—") : "—";

  // Districts filtered by selected province (matching by Arabic province name)
  const districtsForForm = useMemo(() => {
    if (!form.province_id) return [];
    const provAr = provinces.find(p => p.id === form.province_id)?.name_ar;
    if (!provAr) return [];
    return districts.filter(d => d.province_ar === provAr);
  }, [form.province_id, districts, provinces]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter(b => {
      if (filterCourier !== "all" && b.courier_id !== filterCourier) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.address_details || "").toLowerCase().includes(q) ||
        courierName(b.courier_id).toLowerCase().includes(q)
      );
    });
  }, [branches, search, filterCourier, couriers]);

  const openCreate = () => { setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (b: Branch) => {
    setForm({
      id: b.id,
      courier_id: b.courier_id,
      name: b.name,
      province_id: b.province_id || "",
      district_id: b.district_id || "",
      address_details: b.address_details || "",
      lat: b.lat,
      lng: b.lng,
      phone: b.phone || "",
      is_active: b.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.courier_id) { toast.error("اختر شركة الشحن"); return; }
    if (!form.name.trim()) { toast.error("اسم الفرع مطلوب"); return; }
    setSaving(true);
    const payload = {
      courier_id: form.courier_id,
      name: form.name.trim(),
      province_id: form.province_id || null,
      district_id: form.district_id || null,
      address_details: form.address_details.trim() || null,
      lat: form.lat,
      lng: form.lng,
      phone: form.phone.trim() || null,
      is_active: form.is_active,
    };
    const { error } = isEdit
      ? await supabase.from("courier_branches").update(payload).eq("id", form.id)
      : await supabase.from("courier_branches").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "تم تحديث الفرع" : "تم إنشاء الفرع");
    setDialogOpen(false);
    fetchAll();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courier_branches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الفرع");
    fetchAll();
  };

  const toggleActive = async (b: Branch) => {
    const { error } = await supabase.from("courier_branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    setBranches(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الفرع أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filterCourier} onValueChange={setFilterCourier}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="جميع شركات الشحن" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع شركات الشحن</SelectItem>
            {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة فرع
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              لا توجد فروع مسجّلة بعد
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">شركة الشحن</TableHead>
                  <TableHead className="text-right">المحافظة</TableHead>
                  <TableHead className="text-right">المنطقة</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">إحداثيات</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{b.name}</div>
                      {b.address_details && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{b.address_details}</div>
                      )}
                    </TableCell>
                    <TableCell>{courierName(b.courier_id)}</TableCell>
                    <TableCell>{provinceName(b.province_id)}</TableCell>
                    <TableCell>{districtName(b.district_id)}</TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {b.phone ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" /> {b.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {b.lat != null && b.lng != null ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                          <MapPin className="h-3 w-3" />
                          {b.lat.toFixed(3)}, {b.lng.toFixed(3)}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs">بدون موقع</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                        <span className="text-xs text-muted-foreground">
                          {b.is_active ? "مفعّل" : "موقوف"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الفرع؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف الفرع "{b.name}" نهائياً. لا يمكن التراجع.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(b.id)} className="bg-destructive">
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "تعديل فرع" : "إضافة فرع جديد"}</DialogTitle>
            <DialogDescription>
              حدّد بيانات الفرع وضع الدبوس على الخريطة لتحديد إحداثياته.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>شركة الشحن *</Label>
              <Select value={form.courier_id} onValueChange={(v) => setForm({ ...form, courier_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر شركة الشحن" /></SelectTrigger>
                <SelectContent>
                  {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>اسم الفرع *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: فرع المزة" />
            </div>

            <div className="space-y-1.5">
              <Label>المحافظة</Label>
              <Select
                value={form.province_id}
                onValueChange={(v) => setForm({ ...form, province_id: v, district_id: "" })}
              >
                <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                <SelectContent>
                  {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>المنطقة</Label>
              <Select
                value={form.district_id}
                onValueChange={(v) => setForm({ ...form, district_id: v })}
                disabled={!form.province_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.province_id ? "اختر المنطقة" : "اختر المحافظة أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {districtsForForm.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>العنوان التفصيلي</Label>
              <Input
                value={form.address_details}
                onChange={(e) => setForm({ ...form, address_details: e.target.value })}
                placeholder="الشارع، المعالم القريبة..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="09xxxxxxxx"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <span className="text-sm">{form.is_active ? "مفعّل" : "موقوف"}</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <LocationPicker
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) => setForm({ ...form, lat, lng })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              {isEdit ? "حفظ التعديلات" : "إضافة الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}