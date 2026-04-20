import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Printer, Trash2, Package, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import silaLogo from "@/assets/sila-logo.png";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { printShippingLabel } from "@/lib/print-label";

type OrderStatus = "new" | "processing" | "shipped" | "out_for_delivery" | "delivered" | "returned" | "cancelled";

interface OrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  district_id: string | null;
  status: string;
  total_amount: number;
  final_sale_price: number | null;
  shipment_id: string | null;
  created_at: string;
  label_printed_at: string | null;
  notes: string | null;
}

interface DistrictRow {
  id: string;
  name: string;
  parent_id: string | null;
  delivery_fee: number;
}

interface CourierOption {
  id: string;
  name: string;
}

interface CourierRate {
  courier_id: string;
  district_id: string;
  custom_delivery_fee: number;
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "جديد", variant: "outline" },
  processing: { label: "قيد المعالجة", variant: "default" },
  shipped: { label: "قيد التوصيل", variant: "default" },
  out_for_delivery: { label: "خرج للتوصيل", variant: "default" },
  delivered: { label: "تم التوصيل", variant: "secondary" },
  returned: { label: "مرتجع", variant: "destructive" },
  cancelled: { label: "ملغى", variant: "destructive" },
};

interface BoxItem {
  id: string;
  weight: string;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";
const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();
const isLocked = (o: OrderRow) => !!o.label_printed_at || !!o.shipment_id || ["processing", "shipped", "out_for_delivery", "delivered", "returned"].includes(o.status);

export default function MerchantOrdersPage() {
  const { profile, signOut, user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printConfirmId, setPrintConfirmId] = useState<string | null>(null);

  // Districts (real data)
  const [allDistricts, setAllDistricts] = useState<DistrictRow[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [courierRates, setCourierRates] = useState<CourierRate[]>([]);
  useEffect(() => {
    Promise.all([
      supabase.from("districts").select("id, name, parent_id, delivery_fee").order("name"),
      supabase.from("couriers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("courier_district_rates" as any).select("courier_id, district_id, custom_delivery_fee"),
    ]).then(([dRes, cRes, rRes]) => {
      setAllDistricts((dRes.data || []) as DistrictRow[]);
      setCouriers((cRes.data || []) as CourierOption[]);
      setCourierRates((rRes.data || []) as unknown as CourierRate[]);
    });
  }, []);
  const provinces = allDistricts.filter(d => !d.parent_id);
  const areasOf = (provId: string) => allDistricts.filter(d => d.parent_id === provId);

  // Resolve delivery fee: courier-specific rate (district → province fallback) → district default → province default
  const resolveDeliveryFee = (districtId: string | null, provinceId: string | null, courierId: string | null): number => {
    const dDefault = allDistricts.find(d => d.id === districtId)?.delivery_fee ?? 0;
    const pDefault = allDistricts.find(d => d.id === provinceId)?.delivery_fee ?? 0;
    if (!courierId) return dDefault || pDefault;
    if (districtId) {
      const r = courierRates.find(x => x.courier_id === courierId && x.district_id === districtId);
      if (r) return Number(r.custom_delivery_fee);
    }
    if (provinceId) {
      const r = courierRates.find(x => x.courier_id === courierId && x.district_id === provinceId);
      if (r) return Number(r.custom_delivery_fee);
    }
    return dDefault || pDefault;
  };

  // Fetch real orders
  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, receiver_name, phone_number, city, detailed_address, district_id, status, total_amount, final_sale_price, shipment_id, created_at, label_printed_at, notes")
      .eq("merchant_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر تحميل الطلبات");
    else setOrders((data || []) as OrderRow[]);
    setLoading(false);
  };
  useEffect(() => { fetchOrders(); }, [user?.id]);

  // Form state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    provinceId: "",
    districtId: "",
    cod: "",
    courierId: "",
  });
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: crypto.randomUUID(), weight: "" },
  ]);

  const resetForm = () => {
    setForm({ name: "", phone: "", address: "", provinceId: "", districtId: "", cod: "", courierId: "" });
    setBoxes([{ id: crypto.randomUUID(), weight: "" }]);
  };

  const addBox = () => setBoxes((b) => [...b, { id: crypto.randomUUID(), weight: "" }]);
  const removeBox = (id: string) =>
    setBoxes((b) => (b.length > 1 ? b.filter((x) => x.id !== id) : b));
  const updateBox = (id: string, weight: string) =>
    setBoxes((b) => b.map((x) => (x.id === id ? { ...x, weight } : x)));

  const handleCreate = async () => {
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }
    if (!form.name || !form.phone || !form.provinceId) {
      toast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    const prov = provinces.find(p => p.id === form.provinceId);
    const area = allDistricts.find(d => d.id === form.districtId);
    const finalDistrictId = area?.id || prov?.id || null;
    const cityLabel = prov?.name || "";
    const cod = Number(form.cod) || 0;
    const deliveryFee = resolveDeliveryFee(area?.id || null, prov?.id || null, form.courierId || null);

    setSubmitting(true);
    const { error } = await supabase.from("orders").insert({
      merchant_id: user.id,
      receiver_name: form.name,
      phone_number: form.phone,
      city: cityLabel,
      detailed_address: form.address || "",
      district_id: finalDistrictId,
      courier_id: form.courierId || null,
      total_amount: cod,
      delivery_fee: deliveryFee,
      status: "new",
    } as any);
    setSubmitting(false);

    if (error) { toast.error(error.message || "تعذر إنشاء الطلب"); return; }
    toast.success("تم إنشاء الطلب");
    resetForm();
    setCreateOpen(false);
    fetchOrders();
  };

  const confirmPrint = async () => {
    if (!printConfirmId) return;
    const order = orders.find(o => o.id === printConfirmId);
    if (!order) return;

    const prov = provinces.find(p => p.id === order.district_id) || allDistricts.find(d => d.id === order.district_id && !d.parent_id);
    const area = allDistricts.find(d => d.id === order.district_id && d.parent_id);
    const districtName = area?.name || null;

    try {
      printShippingLabel({
        silaCode: silaCodeOf(order.id),
        createdAt: order.created_at,
        sender: {
          storeName: profile?.store_name || "متجر التاجر",
          phone: profile?.phone || null,
          city: profile?.city || null,
        },
        receiver: {
          name: order.receiver_name,
          phone: order.phone_number,
          city: order.city,
          district: districtName,
          address: order.detailed_address,
        },
        cod: Number(order.final_sale_price ?? order.total_amount),
        notes: order.notes,
      });
    } catch (e: any) {
      toast.error(e?.message || "تعذر فتح نافذة الطباعة");
      return;
    }

    // Lock the order in DB only if not already locked
    if (!order.label_printed_at) {
      const newStatus = order.status === "new" ? "processing" : order.status;
      const { error } = await supabase.from("orders")
        .update({ label_printed_at: new Date().toISOString(), status: newStatus } as any)
        .eq("id", printConfirmId);
      if (error) { toast.error("تم فتح البوليصة لكن تعذر قفل الطلب"); }
      else { toast.success("تم اعتماد الطلب وقفله للتعديل"); }
    } else {
      toast.success("إعادة طباعة البوليصة");
    }

    setPrintConfirmId(null);
    fetchOrders();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <MerchantSidebar />

        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Link to="/" className="flex items-center gap-2">
                <img src={silaLogo} alt="Sila" className="h-7 w-7" />
                <span className="font-display font-bold text-lg text-primary">صلة</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {profile?.store_name && (
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {profile.store_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                خروج
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">الطلبات</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  إدارة طلبات الزبائن وطباعة البوالص
                </p>
              </div>
              <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة طلب جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة طلب جديد</DialogTitle>
                    <DialogDescription>
                      أدخل بيانات الزبون والطرود لإنشاء طلب جديد
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2">
                    {/* Customer */}
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">بيانات الزبون</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="name">اسم الزبون *</Label>
                          <Input
                            id="name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="مثال: أحمد العلي"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="phone">رقم الهاتف *</Label>
                          <Input
                            id="phone"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="09xxxxxxxx"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="address">العنوان التفصيلي</Label>
                          <Textarea
                            id="address"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            placeholder="الشارع، رقم البناء، الطابق..."
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="province">المحافظة *</Label>
                          <Select
                            value={form.provinceId}
                            onValueChange={(v) => setForm({ ...form, provinceId: v, districtId: "" })}
                          >
                            <SelectTrigger id="province">
                              <SelectValue placeholder="اختر المحافظة" />
                            </SelectTrigger>
                            <SelectContent>
                              {provinces.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="district">المنطقة / الحي</Label>
                          <Select
                            value={form.districtId}
                            onValueChange={(v) => setForm({ ...form, districtId: v })}
                            disabled={!form.provinceId || areasOf(form.provinceId).length === 0}
                          >
                            <SelectTrigger id="district">
                              <SelectValue placeholder={
                                !form.provinceId ? "اختر محافظة أولاً" :
                                areasOf(form.provinceId).length === 0 ? "لا توجد مناطق" :
                                "اختر المنطقة"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {areasOf(form.provinceId).map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name} <span className="text-xs text-muted-foreground mr-2">({fmtSYP(a.delivery_fee)})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cod">المبلغ المطلوب تحصيله (ل.س)</Label>
                          <Input
                            id="cod"
                            type="number"
                            value={form.cod}
                            onChange={(e) => setForm({ ...form, cod: e.target.value })}
                            placeholder="0"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </section>

                    {/* Boxes */}
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          الطرود ({boxes.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={addBox} className="gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          إضافة طرد
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {boxes.map((box, i) => (
                          <Card key={box.id} className="p-3 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={`w-${box.id}`} className="text-xs text-muted-foreground">
                                الوزن (كغ)
                              </Label>
                              <Input
                                id={`w-${box.id}`}
                                type="number"
                                step="0.1"
                                value={box.weight}
                                onChange={(e) => updateBox(box.id, e.target.value)}
                                placeholder="0.0"
                                dir="ltr"
                                className="mt-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBox(box.id)}
                              disabled={boxes.length === 1}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Card>
                        ))}
                      </div>
                    </section>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                    <Button onClick={handleCreate} disabled={submitting}>{submitting ? "جاري الحفظ..." : "إنشاء الطلب"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Orders Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">المحافظة</TableHead>
                      <TableHead className="text-right">حالة الطلب</TableHead>
                      <TableHead className="text-right">كود صِلة</TableHead>
                      <TableHead className="text-right">بوليصة الناقل</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && orders.map((order) => {
                      const meta = STATUS_META[order.status] || { label: order.status, variant: "outline" as const };
                      const locked = isLocked(order);
                      const districtName = allDistricts.find(d => d.id === order.district_id)?.name;
                      const display = districtName ? `${order.city} - ${districtName}` : order.city;
                      const amount = order.final_sale_price ?? order.total_amount;
                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{order.receiver_name}</div>
                            <div className="text-xs text-muted-foreground" dir="ltr">{order.phone_number}</div>
                          </TableCell>
                          <TableCell className="text-sm">{display}</TableCell>
                          <TableCell>
                            <Badge variant={meta.variant} className="gap-1">
                              {locked && <Lock className="h-3 w-3" />}
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-primary font-semibold" dir="ltr">
                              {silaCodeOf(order.id)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">—</span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {fmtSYP(Number(amount))}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={locked ? "outline" : "default"}
                              onClick={() => setPrintConfirmId(order.id)}
                              className="gap-1.5"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              {locked ? "إعادة طباعة" : "طباعة البوليصة"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && orders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          لا توجد طلبات بعد
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </main>
        </div>

        {/* Print confirmation */}
        <AlertDialog open={!!printConfirmId} onOpenChange={(o) => !o && setPrintConfirmId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                هل أنت متأكد؟
              </AlertDialogTitle>
              <AlertDialogDescription>
                طباعة البوليصة ستؤدي إلى اعتماد الطلب ولا يمكن تعديل بياناته بعد الآن.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPrint}>
                نعم، اعتمد واطبع
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarProvider>
  );
}
