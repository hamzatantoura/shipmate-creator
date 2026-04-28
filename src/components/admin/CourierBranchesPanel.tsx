import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, MapPin, Phone, Building2, Loader2 } from "lucide-react";
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
interface ProvinceLite { id: string; name_ar: string }
interface DistrictLite { id: string; name: string; parent_id: string | null; province_ar: string }

const emptyForm = {
  id: "" as string,
  name: "",
  province_id: "",
  district_id: "",
  address_details: "",
  lat: null as number | null,
  lng: null as number | null,
  phone: "",
  is_active: true,
};

/**
 * Inline panel showing all branches for a single courier.
 * Used inside the courier profile sheet so the admin can see/manage
 * branches in the same place as the courier — and so coverage in
 * "التغطية والتسعير" is naturally tied to where the company actually has presence.
 */
export default function CourierBranchesPanel({ courierId }: { courierId: string }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [provinces, setProvinces] = useState<ProvinceLite[]>([]);
  const [districts, setDistricts] = useState<DistrictLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [toDelete, setToDelete] = useState<Branch | null>(null);
  const isEdit = !!form.id;

  const fetchAll = async () => {
    setLoading(true);
    const [bRes, pRes, dRes] = await Promise.all([
      supabase.from("courier_branches").select("*")
        .eq("courier_id", courierId)
        .order("created_at", { ascending: false }),
      supabase.from("provinces").select("id, name_ar").order("name_ar"),
      supabase.from("districts").select("id, name, parent_id, province_ar").order("name"),
    ]);
    if (bRes.data) setBranches(bRes.data as Branch[]);
    if (pRes.data) setProvinces(pRes.data as ProvinceLite[]);
    if (dRes.data) setDistricts(dRes.data as DistrictLite[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courierId]);

  const provinceName = (id: string | null) => id ? (provinces.find(p => p.id === id)?.name_ar || "—") : "—";
  const districtName = (id: string | null) => id ? (districts.find(d => d.id === id)?.name || "—") : "—";

  const districtsForForm = useMemo(() => {
    if (!form.province_id) return [];
    const provAr = provinces.find(p => p.id === form.province_id)?.name_ar;
    if (!provAr) return [];
    return districts.filter(d => d.province_ar === provAr);
  }, [form.province_id, districts, provinces]);

  // Stats: how many active branches in how many distinct provinces
  const stats = useMemo(() => {
    const active = branches.filter(b => b.is_active);
    const provs = new Set(active.map(b => b.province_id).filter(Boolean));
    return { total: branches.length, active: active.length, provinces: provs.size };
  }, [branches]);

  const openCreate = () => { setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (b: Branch) => {
    setForm({
      id: b.id,
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
    if (!form.name.trim()) { toast.error("اسم الفرع مطلوب"); return; }
    setSaving(true);
    const payload = {
      courier_id: courierId,
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
    setForm({ ...emptyForm });
    fetchAll();
  };

  const toggleActive = async (b: Branch) => {
    const { error } = await supabase.from("courier_branches")
      .update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courier_branches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الفرع");
    fetchAll();
  };

  // Group branches by province for cleaner display
  const grouped = useMemo(() => {
    const m = new Map<string, Branch[]>();
    branches.forEach(b => {
      const key = b.province_id || "__none__";
      const arr = m.get(key) || [];
      arr.push(b);
      m.set(key, arr);
    });
    return Array.from(m.entries()).map(([provId, list]) => ({
      provId,
      provName: provId === "__none__" ? "بدون محافظة" : provinceName(provId),
      list,
    })).sort((a, b) => a.provName.localeCompare(b.provName, "ar"));
  }, [branches, provinces]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Stats bar */}
      <Card className="p-3 bg-muted/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
              <Building2 className="h-3 w-3" /> {stats.active} فرع نشط
            </Badge>
            {stats.total !== stats.active && (
              <Badge variant="outline" className="text-[11px]">
                {stats.total - stats.active} موقوف
              </Badge>
            )}
            <Badge variant="secondary" className="text-[11px] gap-1">
              <MapPin className="h-3 w-3" /> في {stats.provinces} محافظة
            </Badge>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> إضافة فرع
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : branches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          لا توجد فروع لهذه الشركة بعد — اضغط "إضافة فرع" للبدء.
          <p className="text-[11px] mt-2">ملاحظة: المحافظات التي يوجد فيها فرع نشط ستظهر تلقائياً في تبويب "التغطية والتسعير".</p>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          {grouped.map(g => (
            <Card key={g.provId} className="overflow-hidden">
              <div className="flex items-center justify-between bg-muted/40 px-3 py-2 border-b border-border">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> {g.provName}
                </span>
                <Badge variant="outline" className="text-[10px]">{g.list.length} فرع</Badge>
              </div>
              <div className="divide-y divide-border">
                {g.list.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{b.name}</span>
                        {!b.is_active && (
                          <Badge variant="destructive" className="text-[10px]">موقوف</Badge>
                        )}
                        {b.lat && b.lng && (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> محدّد
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {b.district_id && <span>{districtName(b.district_id)}</span>}
                        {b.phone && <span dir="ltr" className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {b.phone}</span>}
                        {b.address_details && <span className="truncate max-w-[200px]">{b.address_details}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)} className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(b)} className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "حدّث بيانات الفرع" : "أدخل بيانات الفرع — سيُربط تلقائياً بهذه الشركة"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>اسم الفرع *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: فرع جبلة" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المحافظة</Label>
                <Select value={form.province_id} onValueChange={(v) => setForm({ ...form, province_id: v, district_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                  <SelectContent>
                    {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المنطقة</Label>
                <Select value={form.district_id} onValueChange={(v) => setForm({ ...form, district_id: v })} disabled={!form.province_id}>
                  <SelectTrigger><SelectValue placeholder={form.province_id ? "اختر المنطقة" : "اختر المحافظة أولاً"} /></SelectTrigger>
                  <SelectContent>
                    {districtsForForm.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>العنوان التفصيلي</Label>
              <Input value={form.address_details} onChange={e => setForm({ ...form, address_details: e.target.value })} placeholder="مثل: جانب مشفى الرحمة" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="0933000000" />
            </div>
            <div className="space-y-1.5">
              <Label>إحداثيات الفرع (اختياري)</Label>
              <LocationPicker
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) => setForm({ ...form, lat, lng })}
              />
            </div>
            <div className="flex items-center justify-between bg-muted/30 rounded-md p-2">
              <Label className="cursor-pointer">الفرع نشط</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setForm({ ...emptyForm }); }}>إلغاء</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "حفظ التعديلات" : "إضافة الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الفرع؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف "{toDelete?.name}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) { remove(toDelete.id); setToDelete(null); } }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Helper hook used by PricingMatrix to know which provinces a courier
 * actually serves (= has at least one active branch in).
 * Returns a Set of province UUIDs.
 */
export function useCourierCoveredProvinces(courierId: string) {
  const [coveredProvinceIds, setCoveredProvinceIds] = useState<Set<string>>(new Set());
  const [branchCountByProvince, setBranchCountByProvince] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("courier_branches")
      .select("province_id, is_active")
      .eq("courier_id", courierId)
      .eq("is_active", true);
    const counts: Record<string, number> = {};
    (data || []).forEach((b: any) => {
      if (!b.province_id) return;
      counts[b.province_id] = (counts[b.province_id] || 0) + 1;
    });
    setBranchCountByProvince(counts);
    setCoveredProvinceIds(new Set(Object.keys(counts)));
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courierId]);

  return { coveredProvinceIds, branchCountByProvince, loading, reload };
}