import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, Plus, Edit2, Trash2, Upload, Download, MapPin, Building2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import LocationPicker from "@/components/LocationPicker";

interface District {
  id: string;
  name: string;
  parent_id: string | null;
  delivery_fee: number;
  is_active: boolean;
  lat?: number | null;
  lng?: number | null;
}

export default function AdminDistrictsManagement() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);

  // ===== Persisted UI state (survives tab switches and refresh in same session) =====
  const SS_KEY = "admin-districts-ui";
  type FormState = { name: string; parent_id: string; lat: string; lng: string };
  type Persisted = {
    search: string;
    expanded: string[];
    dialogOpen: boolean;
    editingId: string | null;
    parentForNew: string | null;
    form: FormState;
  };
  const emptyFormState: FormState = { name: "", parent_id: "", lat: "", lng: "" };
  const readPersisted = (): Persisted => {
    if (typeof window === "undefined") {
      return { search: "", expanded: [], dialogOpen: false, editingId: null, parentForNew: null, form: emptyFormState };
    }
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        return {
          search: p.search ?? "",
          expanded: Array.isArray(p.expanded) ? p.expanded : [],
          dialogOpen: !!p.dialogOpen,
          editingId: p.editingId ?? null,
          parentForNew: p.parentForNew ?? null,
          form: { ...emptyFormState, ...(p.form || {}) },
        };
      }
    } catch { /* ignore */ }
    return { search: "", expanded: [], dialogOpen: false, editingId: null, parentForNew: null, form: emptyFormState };
  };
  const initial = readPersisted();

  const [search, setSearch] = useState(initial.search);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initial.expanded));

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(initial.dialogOpen);
  const [editing, setEditing] = useState<District | null>(null); // hydrated after fetch
  const [editingId, setEditingId] = useState<string | null>(initial.editingId);
  const [parentForNew, setParentForNew] = useState<string | null>(initial.parentForNew);
  const [form, setForm] = useState<FormState>(initial.form);

  // Persist on every relevant change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Persisted = {
      search,
      expanded: Array.from(expanded),
      dialogOpen,
      editingId,
      parentForNew,
      form,
    };
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  }, [search, expanded, dialogOpen, editingId, parentForNew, form]);
  const clearDraft = () => {
    setDialogOpen(false);
    setEditing(null);
    setEditingId(null);
    setParentForNew(null);
    setForm(emptyFormState);
  };

  const [confirmDelete, setConfirmDelete] = useState<District | null>(null);
  const [confirmDeleteAllChildren, setConfirmDeleteAllChildren] = useState<District | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDistricts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("districts")
      .select("id, name, parent_id, delivery_fee, is_active, lat, lng")
      .order("name", { ascending: true });
    if (error) { toast.error("فشل تحميل المناطق"); setLoading(false); return; }
    setDistricts((data || []) as District[]);
    setLoading(false);
  };

  useEffect(() => { fetchDistricts(); }, []);

  // Re-hydrate `editing` reference after districts load (so a persisted edit dialog
  // keeps pointing at the correct row even after a refresh).
  useEffect(() => {
    if (!editingId) { setEditing(null); return; }
    const found = districts.find(d => d.id === editingId) || null;
    setEditing(found);
  }, [districts, editingId]);

  const provinces = useMemo(
    () => districts.filter(d => !d.parent_id).sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [districts]
  );
  const childrenOf = (id: string) => districts.filter(d => d.parent_id === id).sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // Districts (children only) with no coordinates yet — admin must set them manually
  // for the "nearest branch" sorting to work in the merchant order form.
  const missingCoordsCount = useMemo(
    () => districts.filter(d => d.parent_id && (d.lat == null || d.lng == null)).length,
    [districts]
  );
  const missingCoordsByProvince = useMemo(() => {
    const m: Record<string, number> = {};
    districts.forEach(d => {
      if (d.parent_id && (d.lat == null || d.lng == null)) {
        m[d.parent_id] = (m[d.parent_id] || 0) + 1;
      }
    });
    return m;
  }, [districts]);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const filteredProvinces = useMemo(() => {
    let list = provinces;
    if (showOnlyMissing) {
      list = list.filter(p => (missingCoordsByProvince[p.id] || 0) > 0);
    }
    if (!search.trim()) return list;
    const q = search.trim();
    return list.filter(p => {
      if (p.name.includes(q)) return true;
      return childrenOf(p.id).some(c => c.name.includes(q));
    });
  }, [provinces, search, districts, showOnlyMissing, missingCoordsByProvince]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openCreate = (parentId: string | null) => {
    setEditing(null);
    setEditingId(null);
    setParentForNew(parentId);
    setForm({ name: "", parent_id: parentId || "", lat: "", lng: "" });
    setDialogOpen(true);
  };

  const openEdit = (d: District) => {
    setEditing(d);
    setEditingId(d.id);
    setParentForNew(null);
    setForm({
      name: d.name,
      parent_id: d.parent_id || "",
      lat: d.lat != null ? String(d.lat) : "",
      lng: d.lng != null ? String(d.lng) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("الاسم مطلوب"); return; }
    const latVal = form.lat.trim() === "" ? null : Number(form.lat);
    const lngVal = form.lng.trim() === "" ? null : Number(form.lng);
    if ((latVal !== null && isNaN(latVal)) || (lngVal !== null && isNaN(lngVal))) {
      toast.error("الإحداثيات غير صالحة"); return;
    }
    const payload: any = {
      name: form.name.trim(),
      parent_id: form.parent_id || null,
      // delivery_fee is intentionally NOT set from this UI.
      // Pricing comes from courier_pricing_tiers per-courier — never from districts.
      lat: latVal,
      lng: lngVal,
      // Legacy required columns – fill from name
      province: form.parent_id
        ? districts.find(d => d.id === form.parent_id)?.name || form.name.trim()
        : form.name.trim(),
      province_ar: form.parent_id
        ? districts.find(d => d.id === form.parent_id)?.name || form.name.trim()
        : form.name.trim(),
      area: form.parent_id ? form.name.trim() : null,
      area_ar: form.parent_id ? form.name.trim() : null,
    };
    if (!editing) {
      // For new rows the column is NOT NULL with no default — set to 0 (no implicit pricing).
      payload.delivery_fee = 0;
    }

    if (editing) {
      const { error } = await supabase.from("districts").update(payload).eq("id", editing.id);
      if (error) { toast.error("فشل التعديل: " + error.message); return; }
      toast.success("تم التعديل");
    } else {
      const { error } = await supabase.from("districts").insert(payload);
      if (error) { toast.error("فشل الإضافة: " + error.message); return; }
      toast.success(form.parent_id ? "تمت إضافة المنطقة" : "تمت إضافة المحافظة");
    }
    clearDraft();
    fetchDistricts();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("districts").delete().eq("id", confirmDelete.id);
    if (error) { toast.error("فشل الحذف: " + error.message); return; }
    toast.success("تم الحذف");
    setConfirmDelete(null);
    fetchDistricts();
  };

  const handleDeleteAllChildren = async () => {
    if (!confirmDeleteAllChildren) return;
    const province = confirmDeleteAllChildren;
    const kids = childrenOf(province.id);
    if (kids.length === 0) {
      toast.info("لا توجد مناطق لحذفها");
      setConfirmDeleteAllChildren(null);
      return;
    }
    const { error } = await supabase
      .from("districts")
      .delete()
      .eq("parent_id", province.id);
    if (error) { toast.error("فشل الحذف: " + error.message); return; }
    toast.success(`تم حذف ${kids.length} منطقة من ${province.name}`);
    setConfirmDeleteAllChildren(null);
    fetchDistricts();
  };

  // CSV import: columns -> province,area,delivery_fee  (area optional => province row)
  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error("الملف فارغ"); setImporting(false); return; }

      // Parse header (case insensitive, supports Arabic)
      const headerRaw = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^\ufeff/, ""));
      const idxProvince = headerRaw.findIndex(h => ["province", "محافظة", "المحافظة"].includes(h));
      const idxArea = headerRaw.findIndex(h => ["area", "منطقة", "المنطقة", "حي", "الحي"].includes(h));
      const idxFee = headerRaw.findIndex(h => ["delivery_fee", "fee", "رسوم", "أجرة"].includes(h));

      if (idxProvince === -1) {
        toast.error("الملف يجب أن يحتوي على عمود province أو محافظة");
        setImporting(false);
        return;
      }

      // Refresh province cache
      const { data: existing } = await supabase
        .from("districts")
        .select("id, name, parent_id");
      const provMap = new Map<string, string>(); // province name -> id
      (existing || []).forEach((d: any) => {
        if (!d.parent_id) provMap.set(d.name, d.id);
      });

      let createdProv = 0;
      let createdArea = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",").map(c => c.trim());
        const provName = cells[idxProvince]?.trim();
        const areaName = idxArea >= 0 ? cells[idxArea]?.trim() : "";
        const feeVal = idxFee >= 0 ? Number(cells[idxFee]) || 0 : 0;
        if (!provName) { skipped++; continue; }

        // Ensure province exists
        let parentId = provMap.get(provName);
        if (!parentId) {
          const { data: p, error } = await supabase
            .from("districts")
            .insert({
              name: provName, parent_id: null,
              delivery_fee: areaName ? 0 : feeVal,
              province: provName, province_ar: provName,
            })
            .select("id").single();
          if (error || !p) { skipped++; continue; }
          parentId = p.id;
          provMap.set(provName, parentId);
          createdProv++;
        }

        // Add child area if present
        if (areaName) {
          // Avoid duplicates: check existing
          const { data: dup } = await supabase
            .from("districts")
            .select("id")
            .eq("parent_id", parentId)
            .eq("name", areaName)
            .maybeSingle();
          if (dup) { skipped++; continue; }
          const { error } = await supabase.from("districts").insert({
            name: areaName, parent_id: parentId,
            delivery_fee: feeVal,
            province: provName, province_ar: provName,
            area: areaName, area_ar: areaName,
          });
          if (error) { skipped++; continue; }
          createdArea++;
        }
      }

      toast.success(`تم: ${createdProv} محافظة، ${createdArea} منطقة، تم تجاوز ${skipped}`);
      setImportOpen(false);
      fetchDistricts();
    } catch (e: any) {
      toast.error("خطأ في القراءة: " + e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = "province,area,delivery_fee\nدمشق,المزة,15000\nدمشق,الميدان,15000\nحلب,الفرقان,18000\n";
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "districts_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
          <h2 className="text-xl font-display font-bold text-foreground">إدارة المناطق</h2>
          <p className="text-sm text-muted-foreground">المحافظات والأحياء — التسعير يُدار من شركات الشحن</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
            <Download className="h-4 w-4" /> نموذج CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> استيراد CSV
          </Button>
          <Button size="sm" onClick={() => openCreate(null)} className="gap-1.5">
            <Plus className="h-4 w-4" /> محافظة جديدة
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث في المحافظات والأحياء..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{provinces.length} محافظة</Badge>
        <Badge variant="outline">{districts.length - provinces.length} منطقة</Badge>
        {missingCoordsCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowOnlyMissing(v => !v)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors ${
              showOnlyMissing
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-destructive/40 text-destructive hover:bg-destructive/10"
            }`}
            title="عرض المناطق التي تحتاج ضبط إحداثيات يدوياً"
          >
            <AlertTriangle className="h-3 w-3" />
            {missingCoordsCount} منطقة بدون إحداثيات
            {showOnlyMissing && <span className="mr-1 opacity-70">(تم التصفية)</span>}
          </button>
        ) : (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            ✓ كل المناطق لها إحداثيات
          </Badge>
        )}
      </div>

      {/* Tree */}
      {loading ? (
        <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>
      ) : filteredProvinces.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">لا توجد محافظات</p>
      ) : (
        <div className="space-y-2">
          {filteredProvinces.map((p) => {
            const kids = childrenOf(p.id);
            const isOpen = expanded.has(p.id) || (search.trim() && kids.some(k => k.name.includes(search.trim())));
            return (
              <Card key={p.id} className="overflow-hidden">
                {/* Province row */}
                <div className="flex items-center gap-2 p-3 bg-muted/30">
                  <button onClick={() => toggleExpand(p.id)} className="text-muted-foreground hover:text-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </button>
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground flex-1">{p.name}</span>
                  <Badge variant="secondary" className="text-xs">{kids.length} منطقة</Badge>
                  {missingCoordsByProvince[p.id] > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-destructive/50 text-destructive gap-1"
                      title="عدد المناطق بدون إحداثيات"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {missingCoordsByProvince[p.id]} بدون إحداثيات
                    </Badge>
                  )}
                  {/* السعر مُزال عن قصد — التسعير يُدار من شركات الشحن */}
                  <Button size="sm" variant="ghost" onClick={() => openCreate(p.id)} className="gap-1 h-8">
                    <Plus className="h-3.5 w-3.5" /> منطقة
                  </Button>
                  {kids.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteAllChildren(p)}
                      className="gap-1 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="حذف كل المناطق التابعة"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> حذف الكل
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="h-8 w-8">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(p)} className="h-8 w-8 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Children */}
                {isOpen && kids.length > 0 && (
                  <div className="divide-y divide-border">
                    {kids.map(c => (
                      <div key={c.id} className="flex items-center gap-2 p-3 pr-10 hover:bg-muted/20">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground flex-1">{c.name}</span>
                        {(c.lat == null || c.lng == null) && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-destructive/50 text-destructive gap-1 px-1.5 py-0 h-5"
                            title="هذه المنطقة بدون إحداثيات — اضغط تعديل لضبطها على الخريطة"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            بدون إحداثيات
                          </Badge>
                        )}
                        {/* السعر مُزال عن قصد — التسعير يُدار من شركات الشحن */}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)} className="h-7 w-7">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(c)} className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {isOpen && kids.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">لا توجد مناطق فرعية</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) clearDraft(); else setDialogOpen(true); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "تعديل " + (editing.parent_id ? "المنطقة" : "المحافظة")
                : parentForNew
                ? "إضافة منطقة جديدة"
                : "إضافة محافظة جديدة"}
            </DialogTitle>
            <DialogDescription>
              {parentForNew && !editing
                ? `سيتم إضافة المنطقة تحت: ${districts.find(d => d.id === parentForNew)?.name}`
                : "أدخل البيانات بدقة"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">الاسم *</Label>
              <Input
                id="d-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={parentForNew ? "مثال: المزة" : "مثال: دمشق"}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-parent">المحافظة الأم</Label>
              <Select
                value={form.parent_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, parent_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger id="d-parent">
                  <SelectValue placeholder="بدون (محافظة مستقلة)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون (محافظة) —</SelectItem>
                  {provinces
                    .filter(p => !editing || p.id !== editing.id)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-fee">رسوم التوصيل (ل.س)</Label>
              <Input
                id="d-fee"
                type="number"
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
                placeholder="15000"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-lat">خط العرض (Lat)</Label>
                <Input
                  id="d-lat"
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  placeholder="33.5138"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-lng">خط الطول (Lng)</Label>
                <Input
                  id="d-lng"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  placeholder="36.2765"
                  dir="ltr"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              الإحداثيات اختيارية، تُستخدم لحساب أقرب فرع شحن (Haversine).
            </p>

            <LocationPicker
              lat={form.lat ? Number(form.lat) : null}
              lng={form.lng ? Number(form.lng) : null}
              onChange={(lat, lng) => setForm({ ...form, lat: String(lat), lng: String(lng) })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={clearDraft}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? "حفظ التعديل" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>استيراد المناطق من CSV</DialogTitle>
            <DialogDescription>
              الملف يجب أن يحتوي على الأعمدة: <code className="text-xs bg-muted px-1 rounded">province, area, delivery_fee</code>
              <br />
              إذا تركت <code>area</code> فارغاً، يُنشأ كمحافظة. تُنشأ المحافظات تلقائياً عند الحاجة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" /> تحميل ملف نموذج
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
              className="block w-full text-sm text-foreground file:ml-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              disabled={importing}
            />
            {importing && <p className="text-sm text-muted-foreground">جاري الاستيراد...</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{confirmDelete?.name}"؟
              {confirmDelete && !confirmDelete.parent_id && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠ سيتم حذف جميع المناطق الفرعية التابعة لها أيضاً.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Children Confirmation */}
      <AlertDialog open={!!confirmDeleteAllChildren} onOpenChange={(o) => !o && setConfirmDeleteAllChildren(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف جميع المناطق</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <span className="font-bold text-destructive">
                {confirmDeleteAllChildren ? childrenOf(confirmDeleteAllChildren.id).length : 0}
              </span> منطقة تابعة لمحافظة "{confirmDeleteAllChildren?.name}".
              <span className="block mt-2 text-destructive font-medium">
                ⚠ هذا الإجراء لا يمكن التراجع عنه. المحافظة نفسها لن تُحذف.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllChildren} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              حذف الكل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
