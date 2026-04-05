import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Upload, Image as ImageIcon, TrendingUp, Truck, Settings, Bell, ArrowDownCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";

const PLATFORM_MARKUP = 2000;

interface PayoutRequest {
  id: string; merchant_id: string; amount: number; method: string;
  account_details: string; status: string; receipt_url: string | null;
  admin_note: string | null; created_at: string;
}
interface TopUpRequest {
  id: string; merchant_id: string; amount: number; method: string;
  receipt_url: string | null; reference_number: string | null;
  status: string; created_at: string;
}

const METHOD_AR: Record<string, string> = { shamcash: "ShamCash", syriatel_cash: "سيريتل كاش", cash_office: "نقداً من المكتب", bank_transfer: "حوالة بنكية", manual_transfer: "حوالة يدوية" };
const STATUS_AR: Record<string, string> = { pending: "بانتظار المعالجة", processing: "قيد المعالجة", completed: "مكتملة" };
const statusColor = (s: string) => {
  switch (s) {
    case "completed": return "bg-primary/20 text-primary border-primary/30";
    case "processing": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function AdminLogistics() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [topups, setTopups] = useState<TopUpRequest[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [totalShipments, setTotalShipments] = useState(0);

  const pendingTopups = topups.filter(t => t.status === "pending").length;
  const pendingPayouts = payouts.filter(p => p.status === "pending").length;
  const totalPending = pendingTopups + pendingPayouts;

  const fetchData = async () => {
    const { data: p } = await supabase.from("payout_requests").select("*").order("created_at", { ascending: false });
    if (p) setPayouts(p as PayoutRequest[]);

    const { data: t } = await supabase.from("top_up_requests").select("*").order("created_at", { ascending: false });
    if (t) setTopups(t as TopUpRequest[]);

    const { data: shipments } = await supabase.from("shipments").select("status");
    if (shipments) {
      setTotalShipments(shipments.length);
      const delivered = shipments.filter(s => s.status === "delivered").length;
      setDeliveredCount(delivered);
      setTotalProfit(delivered * PLATFORM_MARKUP);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const updatePayoutStatus = async () => {
    if (!selectedPayout || !newStatus) return;
    await supabase.from("payout_requests").update({ status: newStatus } as any).eq("id", selectedPayout.id);
    if (newStatus === "completed") {
      const { data: wallet } = await supabase.from("wallets").select("*").eq("merchant_id", selectedPayout.merchant_id).single();
      if (wallet) {
        const newBalance = Number(wallet.balance) - selectedPayout.amount;
        await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);
        await supabase.from("wallet_transactions").insert({
          wallet_id: wallet.id, type: "payout", amount: -selectedPayout.amount,
          description: `تسوية مالية - ${METHOD_AR[selectedPayout.method] || selectedPayout.method}`, reference_id: selectedPayout.id,
        } as any);
      }
    }
    toast.success("تم تحديث حالة طلب التسوية");
    setSelectedPayout(null); setNewStatus(""); fetchData();
  };

  const uploadReceipt = async (file: File) => {
    if (!selectedPayout) return;
    setUploading(true);
    const path = `receipts/${selectedPayout.id}_${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error("فشل رفع الإيصال"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    await supabase.from("payout_requests").update({ receipt_url: urlData.publicUrl } as any).eq("id", selectedPayout.id);
    toast.success("تم رفع إيصال التحويل");
    setUploading(false); fetchData();
    setSelectedPayout({ ...selectedPayout, receipt_url: urlData.publicUrl });
  };

  const approveTopUp = async (topup: TopUpRequest) => {
    // 1. Update status to completed
    await supabase.from("top_up_requests").update({ status: "completed" } as any).eq("id", topup.id);

    // 2. Get or create wallet
    let { data: wallet } = await supabase.from("wallets").select("*").eq("merchant_id", topup.merchant_id).single();
    if (!wallet) {
      const { data: newWallet } = await supabase.from("wallets").insert({ merchant_id: topup.merchant_id, balance: 0 } as any).select().single();
      wallet = newWallet;
    }
    if (!wallet) { toast.error("خطأ في المحفظة"); return; }

    // 3. Add balance
    const newBalance = Number(wallet.balance) + topup.amount;
    await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);

    // 4. Log transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id, type: "topup", amount: topup.amount,
      description: `شحن رصيد - ${METHOD_AR[topup.method] || topup.method}`, reference_id: topup.id,
    } as any);

    toast.success(`تم شحن ${topup.amount.toLocaleString()} ل.س للتاجر`);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">لوحة الإدارة</h1>
          {totalPending > 0 && (
            <Badge className="bg-destructive text-destructive-foreground gap-1 text-sm px-3 py-1">
              <Bell className="h-4 w-4" /> {totalPending} طلب بانتظار المعالجة
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">أرباح المنصة</p><p className="text-xl font-display font-bold text-primary">{totalProfit.toLocaleString()} ل.س</p></div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">شحنات تم تسليمها</p><p className="text-xl font-display font-bold text-foreground">{deliveredCount} / {totalShipments}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-sm text-muted-foreground">طلبات شحن معلقة</p><p className="text-xl font-display font-bold text-destructive">{pendingTopups}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><CreditCard className="h-5 w-5 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">طلبات تسوية معلقة</p><p className="text-xl font-display font-bold text-warning">{pendingPayouts}</p></div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="topups" dir="rtl">
          <TabsList>
            <TabsTrigger value="topups" className="gap-1.5">
              <ArrowDownCircle className="h-3.5 w-3.5" /> طلبات شحن الرصيد
              {pendingTopups > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 mr-1">{pendingTopups}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> طلبات التسوية
              {pendingPayouts > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 mr-1">{pendingPayouts}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topups" className="mt-4">
            {topups.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">لا توجد طلبات شحن رصيد</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاجر</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الطريقة</TableHead>
                      <TableHead className="text-right">رقم المرجع</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topups.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.merchant_id.slice(0, 8)}...</TableCell>
                        <TableCell className="font-display font-bold">{t.amount.toLocaleString()} ل.س</TableCell>
                        <TableCell>{METHOD_AR[t.method] || t.method}</TableCell>
                        <TableCell>{(t as any).reference_number || "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("ar")}</TableCell>
                        <TableCell><Badge variant="outline" className={statusColor(t.status)}>{STATUS_AR[t.status] || t.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {t.receipt_url && (
                              <Button variant="ghost" size="icon" onClick={() => setReceiptPreview(t.receipt_url)}>
                                <ImageIcon className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {t.status === "pending" && (
                              <Button size="sm" className="gap-1" onClick={() => approveTopUp(t)}>
                                <CheckCircle className="h-3.5 w-3.5" /> موافقة
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            {payouts.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">لا توجد طلبات تسوية</p>
            ) : (
              <div className="space-y-3">
                {payouts.map(p => (
                  <Card key={p.id} className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => { setSelectedPayout(p); setNewStatus(p.status); }}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-display font-bold text-foreground text-lg">{Number(p.amount).toLocaleString()} ل.س</p>
                        <p className="text-sm text-muted-foreground">{METHOD_AR[p.method] || p.method} — {p.account_details}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.receipt_url && <ImageIcon className="h-4 w-4 text-primary" />}
                        <Badge variant="outline" className={statusColor(p.status)}>{STATUS_AR[p.status] || p.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Payout detail dialog */}
        <Dialog open={!!selectedPayout} onOpenChange={o => !o && setSelectedPayout(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader><DialogTitle>تفاصيل طلب التسوية</DialogTitle></DialogHeader>
            {selectedPayout && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">المبلغ:</span> <span className="font-bold">{Number(selectedPayout.amount).toLocaleString()} ل.س</span></div>
                  <div><span className="text-muted-foreground">الطريقة:</span> <span className="font-bold">{METHOD_AR[selectedPayout.method] || selectedPayout.method}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">تفاصيل الحساب:</span> <span className="font-bold">{selectedPayout.account_details}</span></div>
                </div>
                <div className="space-y-2">
                  <Label>تحديث الحالة</Label>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">بانتظار المعالجة</SelectItem>
                        <SelectItem value="processing">قيد المعالجة</SelectItem>
                        <SelectItem value="completed">مكتملة</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={updatePayoutStatus} disabled={newStatus === selectedPayout.status}>حفظ</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>إيصال التحويل</Label>
                  {selectedPayout.receipt_url ? <img src={selectedPayout.receipt_url} alt="receipt" className="rounded-lg border border-border max-h-48 object-contain" /> : <p className="text-xs text-muted-foreground">لم يتم رفع إيصال بعد</p>}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadReceipt(e.target.files[0])} />
                    <Button variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
                      <span><Upload className="h-4 w-4" />{uploading ? "جاري الرفع..." : "رفع إيصال"}</span>
                    </Button>
                  </label>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Receipt preview dialog */}
        <Dialog open={!!receiptPreview} onOpenChange={o => !o && setReceiptPreview(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>صورة الإيصال</DialogTitle></DialogHeader>
            {receiptPreview && <img src={receiptPreview} alt="receipt" className="rounded-lg max-h-96 object-contain mx-auto" />}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
