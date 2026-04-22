import { useCallback, useEffect, useMemo, useState } from "react";
import { format, endOfDay, endOfMonth, isSameDay, startOfMonth, startOfToday } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ArrowUpLeft,
  CalendarIcon,
  CheckCircle2,
  Clock3,
  Download,
  Landmark,
  Loader2,
  Plus,
  RotateCcw,
  Truck,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import WalletTransactionsLog from "@/components/shared/WalletTransactionsLog";
import { toast } from "sonner";

type OrderStatus = "delivered" | "returned" | "out_for_delivery" | string;

interface CourierInfo {
  id: string;
  name: string;
  cod_fee_type: string;
  cod_fee_value: number;
  wallet_balance?: number;
}

interface OrderRow {
  id: string;
  status: OrderStatus;
  final_sale_price: number | null;
  total_amount: number;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
}

interface SettlementRow {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | string;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  admin_note: string | null;
  created_at: string;
}

interface DateRangeState {
  from: Date;
  to: Date;
}

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(value || 0))} ل.س`;

const getSilaCode = (id: string) => `SL-${id.slice(0, 6).toUpperCase()}`;

const normalizeNumber = (value: number | null | undefined) => Number(value ?? 0);

const getCodFee = (saleAmount: number, courier: CourierInfo | null) => {
  if (!courier) return 0;
  const feeValue = normalizeNumber(courier.cod_fee_value);
  return courier.cod_fee_type === "percentage" ? (saleAmount * feeValue) / 100 : feeValue;
};

export default function CourierWalletPanel() {
  const { user } = useAuth();
  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeState>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    reference: "",
    notes: "",
  });

  const loadWalletData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: courierData, error: courierError } = await supabase
        .from("couriers")
        .select("id, name, cod_fee_type, cod_fee_value, wallet_balance")
        .eq("vendor_id", user.id)
        .maybeSingle();

      if (courierError) throw courierError;
      if (!courierData) {
        setCourier(null);
        setOrders([]);
        setSettlements([]);
        toast.error("لم يتم العثور على شركة الشحن المرتبطة بهذا الحساب");
        return;
      }

      setCourier(courierData);

      const fromIso = dateRange.from.toISOString();
      const toIso = endOfDay(dateRange.to).toISOString();

      const [ordersResponse, settlementsResponse] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, final_sale_price, total_amount, delivery_fee, created_at, updated_at")
          .eq("courier_id", courierData.id)
          .gte("updated_at", fromIso)
          .lte("updated_at", toIso)
          .order("updated_at", { ascending: false }),
        supabase
          .from("courier_settlements")
          .select("id, amount, status, reference, notes, payment_date, admin_note, created_at")
          .eq("courier_id", courierData.id)
          .order("created_at", { ascending: false }),
      ]);

      if (ordersResponse.error) throw ordersResponse.error;
      if (settlementsResponse.error) throw settlementsResponse.error;

      setOrders((ordersResponse.data ?? []) as OrderRow[]);
      setSettlements((settlementsResponse.data ?? []) as SettlementRow[]);
    } catch (error) {
      console.error("Courier wallet load error:", error);
      toast.error("تعذر تحميل لوحة المحفظة المالية");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, user]);

  useEffect(() => {
    void loadWalletData();
  }, [loadWalletData]);

  const metrics = useMemo(() => {
    const today = startOfToday();
    let expectedCashToday = 0;
    let totalCashCollected = 0;
    let shippingEarnings = 0;
    let codEarnings = 0;
    let returnsEarnings = 0;

    const finalizedOrders = orders.filter((order) => order.status === "delivered" || order.status === "returned");

    for (const order of orders) {
      const saleAmount = normalizeNumber(order.final_sale_price ?? order.total_amount);
      const shippingFee = normalizeNumber(order.delivery_fee);
      const codFee = getCodFee(saleAmount, courier);

      if (order.status === "out_for_delivery" && isSameDay(new Date(order.updated_at), today)) {
        expectedCashToday += saleAmount;
      }

      if (order.status === "delivered") {
        totalCashCollected += saleAmount;
        shippingEarnings += shippingFee;
        codEarnings += codFee;
      }

      if (order.status === "returned") {
        returnsEarnings += shippingFee;
      }
    }

    const approvedSettlements = settlements
      .filter((settlement) => settlement.status === "approved")
      .reduce((sum, settlement) => sum + normalizeNumber(settlement.amount), 0);

    const pendingSettlements = settlements
      .filter((settlement) => settlement.status === "pending")
      .reduce((sum, settlement) => sum + normalizeNumber(settlement.amount), 0);

    const totalEarnings = shippingEarnings + codEarnings + returnsEarnings;
    const netOwedToSila = totalCashCollected - totalEarnings - approvedSettlements;

    return {
      expectedCashToday,
      totalCashCollected,
      shippingEarnings,
      codEarnings,
      returnsEarnings,
      totalEarnings,
      approvedSettlements,
      pendingSettlements,
      netOwedToSila,
      finalizedOrders,
    };
  }, [courier, orders, settlements]);

  const settlementStats = useMemo(() => {
    const approvedCount = settlements.filter((row) => row.status === "approved").length;
    const pendingCount = settlements.filter((row) => row.status === "pending").length;
    const rejectedCount = settlements.filter((row) => row.status === "rejected").length;

    return { approvedCount, pendingCount, rejectedCount };
  }, [settlements]);

  const handleQuickRange = (mode: "month" | "today") => {
    if (mode === "today") {
      const today = new Date();
      setDateRange({ from: today, to: today });
      return;
    }

    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  };

  const handleExportLedger = () => {
    const rows = [
      ["رمز التتبع", "التاريخ", "الحالة", "المبلغ الأصلي", "أجرة الشحن", "بدل التحصيل", "الصافي المستحق للمنصة"],
      ...metrics.finalizedOrders.map((order) => {
        const saleAmount = normalizeNumber(order.final_sale_price ?? order.total_amount);
        const shippingFee = normalizeNumber(order.delivery_fee);
        const codFee = order.status === "delivered" ? getCodFee(saleAmount, courier) : 0;
        const netOwed = order.status === "delivered" ? saleAmount - shippingFee - codFee : -shippingFee;

        return [
          getSilaCode(order.id),
          format(new Date(order.updated_at), "yyyy-MM-dd"),
          order.status === "delivered" ? "مُسلّم" : "مرتجع",
          String(Math.round(saleAmount)),
          String(Math.round(shippingFee)),
          String(Math.round(codFee)),
          String(Math.round(netOwed)),
        ];
      }),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `courier-ledger-${format(dateRange.from, "yyyy-MM-dd")}-${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleSubmitSettlement = async () => {
    if (!courier) return;

    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغًا صحيحًا للتحويل");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("courier_settlements").insert({
        courier_id: courier.id,
        amount,
        payment_date: paymentForm.paymentDate,
        reference: paymentForm.reference.trim() || null,
        notes: paymentForm.notes.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("تم تسجيل الدفعة وإرسالها للمراجعة");
      setDialogOpen(false);
      setPaymentForm({
        amount: "",
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        reference: "",
        notes: "",
      });
      void loadWalletData();
    } catch (error) {
      console.error("Settlement submit error:", error);
      toast.error("تعذر تسجيل الدفعة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">المحفظة المالية</h2>
          <p className="text-sm text-muted-foreground">
            متابعة التحصيلات، أرباح الشحن، وتسويات شركة الشحن ضمن الفترة المحددة.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleQuickRange("today")}>اليوم</Button>
          <Button variant="outline" size="sm" onClick={() => handleQuickRange("month")}>هذا الشهر</Button>
          <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            تسجيل دفعة
          </Button>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">من تاريخ</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full min-w-[220px] justify-start text-right font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ms-2 h-4 w-4" />
                      {format(dateRange.from, "PPP", { locale: ar })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange((current) => ({ ...current, from: date }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full min-w-[220px] justify-start text-right font-normal",
                        !dateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ms-2 h-4 w-4" />
                      {format(dateRange.to, "PPP", { locale: ar })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange((current) => ({ ...current, to: date }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{courier?.name ?? "شركة الشحن"}</Badge>
              <span>الفترة: {format(dateRange.from, "yyyy/MM/dd")} — {format(dateRange.to, "yyyy/MM/dd")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard icon={Clock3} title="نقد متوقع اليوم" value={metrics.expectedCashToday} description="طلبات قيد التوصيل اليوم" tone="warning" />
            <MetricCard icon={Wallet} title="إجمالي النقد المحصّل" value={metrics.totalCashCollected} description="من الطلبات المُسلّمة" tone="primary" />
            <MetricCard icon={Truck} title="أرباح الشحن" value={metrics.shippingEarnings} description="إجمالي أجور التوصيل" tone="success" />
            <MetricCard icon={Landmark} title="أرباح بدل التحصيل" value={metrics.codEarnings} description="عمولة COD للطلبات المُسلّمة" tone="success" />
            <MetricCard icon={RotateCcw} title="أرباح المرتجعات" value={metrics.returnsEarnings} description="رسوم الطلبات المرتجعة فقط" tone="muted" />
            <MetricCard icon={ArrowUpLeft} title="إجمالي الأرباح" value={metrics.totalEarnings} description="شحن + COD + مرتجعات" tone="success" />
            <MetricCard icon={CheckCircle2} title="التسويات المعتمدة" value={metrics.approvedSettlements} description="دفعات وافقت عليها الإدارة" tone="primary" />
            <MetricCard icon={Clock3} title="التسويات المعلقة" value={metrics.pendingSettlements} description="بانتظار الاعتماد" tone="warning" />
            <Card className={cn(
              "border-2",
              metrics.netOwedToSila > 0 ? "border-destructive/40 bg-destructive/5" : "border-success/40 bg-success/5"
            )}>
              <CardHeader className="pb-2">
                <CardDescription>صافي المستحق لمنصة Sila</CardDescription>
                <CardTitle className={cn(
                  "text-2xl",
                  metrics.netOwedToSila > 0 ? "text-destructive" : "text-success"
                )}>
                  {formatCurrency(Math.abs(metrics.netOwedToSila))}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {metrics.netOwedToSila > 0 ? "ما يزال على شركة الشحن مبلغ مستحق للمنصة." : "لا توجد مستحقات مفتوحة حالياً."}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="ledger" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ledger">السجل المالي</TabsTrigger>
              <TabsTrigger value="settlements">التسويات والدفعات</TabsTrigger>
            </TabsList>

            <TabsContent value="ledger">
              <Card>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>دفتر القيود للطلبات النهائية</CardTitle>
                    <CardDescription>يعرض الطلبات المُسلّمة والمرتجعة ضمن الفلترة الحالية.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleExportLedger}>
                    <Download className="h-4 w-4" />
                    تصدير CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>رمز التتبع</TableHead>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>المبلغ الأصلي</TableHead>
                          <TableHead>أجرة الشحن</TableHead>
                          <TableHead>بدل التحصيل</TableHead>
                          <TableHead>الصافي المستحق للمنصة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.finalizedOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                              لا توجد طلبات نهائية ضمن هذه الفترة.
                            </TableCell>
                          </TableRow>
                        ) : (
                          metrics.finalizedOrders.map((order) => {
                            const saleAmount = normalizeNumber(order.final_sale_price ?? order.total_amount);
                            const shippingFee = normalizeNumber(order.delivery_fee);
                            const codFee = order.status === "delivered" ? getCodFee(saleAmount, courier) : 0;
                            const netOwed = order.status === "delivered" ? saleAmount - shippingFee - codFee : -shippingFee;

                            return (
                              <TableRow key={order.id}>
                                <TableCell className="font-mono text-xs">{getSilaCode(order.id)}</TableCell>
                                <TableCell>{format(new Date(order.updated_at), "yyyy-MM-dd")}</TableCell>
                                <TableCell>
                                  <Badge variant={order.status === "delivered" ? "default" : "secondary"}>
                                    {order.status === "delivered" ? "مُسلّم" : "مرتجع"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatCurrency(saleAmount)}</TableCell>
                                <TableCell className="text-success">-{formatCurrency(shippingFee)}</TableCell>
                                <TableCell className="text-success">-{formatCurrency(codFee)}</TableCell>
                                <TableCell className={cn("font-medium", netOwed > 0 ? "text-destructive" : "text-success")}>
                                  {netOwed > 0 ? "+" : ""}{formatCurrency(netOwed)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settlements">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <Card>
                  <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>سجل التحويلات والتسويات</CardTitle>
                      <CardDescription>كل الحوالات المرفوعة من شركة الشحن إلى Sila.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      تسجيل دفعة
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>التاريخ</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead>ملاحظات</TableHead>
                            <TableHead>ملاحظة الإدارة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {settlements.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                لا توجد دفعات مسجلة حتى الآن.
                              </TableCell>
                            </TableRow>
                          ) : (
                            settlements.map((settlement) => (
                              <TableRow key={settlement.id}>
                                <TableCell>{format(new Date(settlement.payment_date), "yyyy-MM-dd")}</TableCell>
                                <TableCell>{formatCurrency(settlement.amount)}</TableCell>
                                <TableCell>
                                  <SettlementBadge status={settlement.status} />
                                </TableCell>
                                <TableCell className="text-xs">{settlement.reference || "—"}</TableCell>
                                <TableCell className="text-xs">{settlement.notes || "—"}</TableCell>
                                <TableCell className="text-xs">{settlement.admin_note || "—"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>ملخص التسويات</CardTitle>
                    <CardDescription>نظرة سريعة على حالات التحويلات الحالية.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <SummaryLine label="معتمدة" value={settlementStats.approvedCount} tone="success" />
                    <SummaryLine label="قيد المراجعة" value={settlementStats.pendingCount} tone="warning" />
                    <SummaryLine label="مرفوضة" value={settlementStats.rejectedCount} tone="destructive" />
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground">
                      آخر رصيد معروف: {formatCurrency(normalizeNumber(courier?.wallet_balance))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {user && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">سجل الحركات المالية</CardTitle>
                <CardDescription>للأغراض المحاسبية فقط.</CardDescription>
              </CardHeader>
              <CardContent>
                <WalletTransactionsLog vendorId={user.id} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة جديدة</DialogTitle>
            <DialogDescription>
              أرسل تفاصيل الحوالة ليتم تدقيقها من الإدارة واعتمادها ضمن تسويات شركة الشحن.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="settlement-amount">المبلغ</Label>
              <Input
                id="settlement-amount"
                inputMode="decimal"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="settlement-date">تاريخ الحوالة</Label>
              <Input
                id="settlement-date"
                type="date"
                value={paymentForm.paymentDate}
                onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="settlement-reference">المرجع / رقم الإيصال</Label>
              <Input
                id="settlement-reference"
                value={paymentForm.reference}
                onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                placeholder="رقم العملية أو اسم البنك"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="settlement-notes">ملاحظات</Label>
              <Textarea
                id="settlement-notes"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="أي تفاصيل إضافية تساعد الإدارة على المطابقة"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={handleSubmitSettlement} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              حفظ الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  description,
  tone,
}: {
  icon: typeof Wallet;
  title: string;
  value: number;
  description: string;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{title}</CardDescription>
          <Icon className={cn("h-4 w-4", toneClass)} />
        </div>
        <CardTitle className="text-2xl">{formatCurrency(value)}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  );
}

function SettlementBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">معتمدة</Badge>;
  if (status === "rejected") return <Badge variant="destructive">مرفوضة</Badge>;
  return <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">قيد المراجعة</Badge>;
}

function SummaryLine({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "destructive" }) {
  const toneClass = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", toneClass)}>{value}</span>
    </div>
  );
}