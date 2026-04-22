import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar as CalendarIcon, Wallet, TrendingUp, TrendingDown, Truck, Package, RotateCcw, CheckCircle2, Clock, Download, Plus, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtSYP = (n: number) =>
  new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " ل.س";
const silaCode = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();

interface OrderRow {
  id: string;
  status: string;
  final_sale_price: number | null;
  total_amount: number;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
}

interface SettlementRow {
  id: string;
  amount: number;
  status: string;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  admin_note: string | null;
  created_at: string;
}

interface CourierInfo {
  id: string;
  name: string;
  cod_fee_type: string;
  cod_fee_value: number;
}

function calcCodFee(saleAmount: number, courier: CourierInfo | null): number {
  if (!courier) return 0;
  const v = Number(courier.cod_fee_value || 0);
  if (courier.cod_fee_type === "percentage") return (saleAmount * v) / 100;
  return v;
}

export default function CourierWallet() {
  const { user, signOut } = useAuth();
  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    reference: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Resolve courier_id
      const { data: courierData, error: cErr } = await supabase
        .from("couriers")
        .select("id, name, cod_fee_type, cod_fee_value")
        .eq("vendor_id", user.id)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!courierData) {
        toast.error("لم يتم العثور على شركة الشحن المرتبطة بحسابك");
        setLoading(false);
        return;
      }
      setCourier(courierData);

      // 2. Load orders in date range
      const fromIso = from.toISOString();
      const toIsoEnd = new Date(to.getTime() + 86399999).toISOString();
      const [{ data: ordersData, error: oErr }, { data: settlementsData, error: sErr }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, final_sale_price, total_amount, delivery_fee, created_at, updated_at")
          .eq("courier_id", courierData.id)
          .gte("updated_at", fromIso)
          .lte("updated_at", toIsoEnd)
          .order("updated_at", { ascending: false }),
        supabase
          .from("courier_settlements")
          .select("id, amount, status, reference, notes, payment_date, admin_note, created_at")
          .eq("courier_id", courierData.id)
          .order("created_at", { ascending: false }),
      ]);
      if (oErr) throw oErr;
      if (sErr) throw sErr;
      setOrders((ordersData ?? []) as OrderRow[]);
      setSettlements((settlementsData ?? []) as SettlementRow[]);
    } catch (err) {
      console.error(err);
      toast.error("فشل تحميل بيانات المحفظة");
    } finally {
      setLoading(false);
    }
  }, [user, from, to]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ===== KPI calculations =====
  const kpi = useMemo(() => {
    let expectedToday = 0;
    let cashCollected = 0;
    let shippingEarnings = 0;
    let codEarnings = 0;
    let returnsEarnings = 0;
    const finalized: OrderRow[] = [];

    for (const o of orders) {
      const sale = Number(o.final_sale_price ?? o.total_amount ?? 0);
      const fee = Number(o.delivery_fee ?? 0);
      if (o.status === "out_for_delivery") expectedToday += sale;
      if (o.status === "delivered") {
        cashCollected += sale;
        shippingEarnings += fee;
        codEarnings += calcCodFee(sale, courier);
        finalized.push(o);
      }
      if (o.status === "returned") {
        returnsEarnings += fee;
        finalized.push(o);
      }
    }
    const totalEarnings = shippingEarnings + codEarnings + returnsEarnings;
    const approvedSettlements = settlements
      .filter((s) => s.status === "approved")
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const pendingSettlements = settlements
      .filter((s) => s.status === "pending")
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const netOwed = cashCollected - totalEarnings - approvedSettlements;
    return {
      expectedToday, cashCollected, shippingEarnings, codEarnings,
      returnsEarnings, totalEarnings, approvedSettlements, pendingSettlements,
      netOwed, finalized,
    };
  }, [orders, settlements, courier]);

  const handleSubmitSettlement = async () => {
    if (!courier) return;
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      toast.error("الرجاء إدخال مبلغ صحيح");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("courier_settlements").insert({
        courier_id: courier.id,
        amount: amt,
        payment_date: form.payment_date,
        reference: form.reference || null,
        notes: form.notes || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("تم تسجيل الدفعة بانتظار موافقة الإدارة");
      setDialogOpen(false);
      setForm({ amount: "", payment_date: format(new Date(), "yyyy-MM-dd"), reference: "", notes: "" });
      void loadData();
    } catch (err) {
      console.error(err);
      toast.error("فشل تسجيل الدفعة");
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["كود سلة", "التاريخ", "الحالة", "المبلغ الأصلي", "أجرة الشحن", "بدل التحصيل", "صافي مستحق للمنصة"],
      ...kpi.finalized.map((o) => {
        const sale = Number(o.final_sale_price ?? o.total_amount ?? 0);
        const fee = Number(o.delivery_fee ?? 0);
        const cod = o.status === "delivered" ? calcCodFee(sale, courier) : 0;
        const net = o.status === "delivered" ? sale - fee - cod : -fee;
        return [
          silaCode(o.id),
          format(new Date(o.updated_at), "yyyy-MM-dd"),
          o.status,
          String(sale),
          String(fee),
          String(Math.round(cod)),
          String(Math.round(net)),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `courier-ledger-${format(from, "yyyy-MM-dd")}_${format(to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/courier/orders">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> الطلبات
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">المحفظة المالية</span>
              {courier && <Badge variant="outline" className="text-xs">{courier.name}</Badge>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>خروج</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Date Range */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">من تاريخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[160px] justify-start">
                    <CalendarIcon className="h-4 w-4" />
                    {format(from, "PPP", { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={from} onSelect={(d) => d && setFrom(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[160px] justify-start">
                    <CalendarIcon className="h-4 w-4" />
                    {format(to, "PPP", { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={to} onSelect={(d) => d && setTo(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" size="sm" onClick={() => { setFrom(startOfMonth(new Date())); setTo(endOfMonth(new Date())); }}>
                الشهر الحالي
              </Button>
              <Button size="sm" onClick={() => void loadData()}>تحديث</Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={Clock} title="نقد متوقع اليوم" value={kpi.expectedToday} tone="warning" hint="قيد التوصيل" />
              <KpiCard icon={Wallet} title="إجمالي النقد المُحصَّل" value={kpi.cashCollected} tone="primary" hint="من الطلبات المُسلَّمة" />
              <KpiCard icon={Truck} title="أرباح الشحن" value={kpi.shippingEarnings} tone="success" hint="أجور التوصيل" />
              <KpiCard icon={Package} title="أرباح بدل التحصيل" value={kpi.codEarnings} tone="success" hint="عمولة COD" />
              <KpiCard icon={RotateCcw} title="أرباح المرتجعات" value={kpi.returnsEarnings} tone="muted" hint="رسوم الطلبات المرتجعة" />
              <KpiCard icon={TrendingUp} title="إجمالي الأرباح" value={kpi.totalEarnings} tone="success" hint="شحن + COD + مرتجعات" />
              <KpiCard icon={CheckCircle2} title="تسويات معتمدة" value={kpi.approvedSettlements} tone="primary" hint="مدفوعة لـ Sila" />
              <KpiCard icon={Clock} title="تسويات قيد المراجعة" value={kpi.pendingSettlements} tone="warning" hint="بانتظار الإدارة" />
            </div>

            {/* Net Owed — hero card */}
            <Card className={cn(
              "border-2",
              kpi.netOwed > 0 ? "border-destructive/50 bg-destructive/5" : "border-success/50 bg-success/5"
            )}>
              <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  {kpi.netOwed > 0 ? (
                    <TrendingDown className="h-10 w-10 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">صافي المستحق لمنصة Sila</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      kpi.netOwed > 0 ? "text-destructive" : "text-success"
                    )}>
                      {fmtSYP(Math.abs(kpi.netOwed))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpi.netOwed > 0 ? "يجب تحويل هذا المبلغ للمنصة" : "تم تسوية كامل المستحقات ✓"}
                    </p>
                  </div>
                </div>
                <Button size="lg" onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> تسجيل دفعة
                </Button>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="ledger" className="w-full">
              <TabsList>
                <TabsTrigger value="ledger">السجل المالي ({kpi.finalized.length})</TabsTrigger>
                <TabsTrigger value="settlements">التسويات والدفعات ({settlements.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="ledger">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>سجل الطلبات النهائية</CardTitle>
                      <CardDescription>الطلبات المُسلَّمة والمرتجعة خلال الفترة</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
                      <Download className="h-4 w-4" /> تصدير CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>كود سلة</TableHead>
                            <TableHead>التاريخ</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>المبلغ الأصلي</TableHead>
                            <TableHead>أجرة الشحن</TableHead>
                            <TableHead>بدل COD</TableHead>
                            <TableHead>صافي مستحق للمنصة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kpi.finalized.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                لا توجد طلبات نهائية في هذه الفترة
                              </TableCell>
                            </TableRow>
                          ) : kpi.finalized.map((o) => {
                            const sale = Number(o.final_sale_price ?? o.total_amount ?? 0);
                            const fee = Number(o.delivery_fee ?? 0);
                            const cod = o.status === "delivered" ? calcCodFee(sale, courier) : 0;
                            const net = o.status === "delivered" ? sale - fee - cod : -fee;
                            return (
                              <TableRow key={o.id}>
                                <TableCell className="font-mono text-xs">{silaCode(o.id)}</TableCell>
                                <TableCell className="text-xs">{format(new Date(o.updated_at), "yyyy-MM-dd")}</TableCell>
                                <TableCell>
                                  <Badge variant={o.status === "delivered" ? "default" : "secondary"}>
                                    {o.status === "delivered" ? "مُسلَّم" : "مرتجع"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{fmtSYP(sale)}</TableCell>
                                <TableCell className="text-success">−{fmtSYP(fee)}</TableCell>
                                <TableCell className="text-success">−{fmtSYP(cod)}</TableCell>
                                <TableCell className={cn("font-semibold", net > 0 ? "text-destructive" : "text-success")}>
                                  {net > 0 ? "+" : ""}{fmtSYP(net)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settlements">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>سجل الدفعات</CardTitle>
                      <CardDescription>الدفعات التي تم تحويلها إلى منصة Sila</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" /> تسجيل دفعة
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>تاريخ الدفع</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead>ملاحظات</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>ملاحظة الإدارة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {settlements.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                لم يتم تسجيل أي دفعات بعد
                              </TableCell>
                            </TableRow>
                          ) : settlements.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-xs">{s.payment_date}</TableCell>
                              <TableCell className="font-semibold">{fmtSYP(Number(s.amount))}</TableCell>
                              <TableCell className="font-mono text-xs">{s.reference || "—"}</TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate">{s.notes || "—"}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  s.status === "approved" ? "default" :
                                  s.status === "rejected" ? "destructive" : "secondary"
                                }>
                                  {s.status === "approved" ? "معتمدة" : s.status === "rejected" ? "مرفوضة" : "قيد المراجعة"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.admin_note || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Settlement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة جديدة</DialogTitle>
            <DialogDescription>
              سجّل تحويلًا قمت به إلى منصة Sila. ستراجعه الإدارة وتعتمده.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>المبلغ (ل.س) *</Label>
              <Input type="number" min="1" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="مثال: 500000" />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الدفع *</Label>
              <Input type="date" value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>رقم المرجع / الحوالة</Label>
              <Input value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="رقم الحوالة البنكية أو الإيصال" />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} rows={3}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="تفاصيل إضافية..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={handleSubmitSettlement} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إرسال للمراجعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, tone, hint }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  tone: "primary" | "success" | "warning" | "muted";
  hint?: string;
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <Icon className={cn("h-4 w-4", toneClass)} />
        </div>
        <p className={cn("text-xl font-bold", toneClass)}>{fmtSYP(value)}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}