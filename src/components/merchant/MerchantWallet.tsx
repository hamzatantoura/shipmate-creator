import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, ArrowDownCircle, TrendingDown, TrendingUp, CreditCard, Image as ImageIcon, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const TYPE_AR: Record<string, string> = {
  topup: "شحن رصيد", shipping_fee: "رسوم شحن", cod_settlement: "تسوية COD",
  commission: "عمولة المنصة", carrier_adjustment: "تعديل الناقل", return_fee: "رسوم إرجاع", payout: "تسوية مالية",
};
const PAYOUT_METHODS = [
  { value: "shamcash", label: "ShamCash" }, { value: "syriatel_cash", label: "سيريتل كاش" },
  { value: "cash_office", label: "نقداً من المكتب" }, { value: "bank_transfer", label: "حوالة بنكية" },
];
const PAYOUT_STATUS_AR: Record<string, string> = { pending: "بانتظار المعالجة", processing: "قيد المعالجة", completed: "مكتملة" };

const ORDER_STATUS_AR: Record<string, string> = {
  new: "جديد", processing: "قيد المعالجة", assigned: "تم التعيين",
  out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", returned: "مرتجع",
  pending: "قيد الانتظار", shipped: "تم الشحن",
};

interface WalletTx { id: string; type: string; amount: number; description: string | null; created_at: string; reference_id: string | null; }
interface PayoutReq { id: string; amount: number; method: string; account_details: string; status: string; receipt_url: string | null; created_at: string; }

export default function MerchantWallet() {
  const { user } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0);
  const [platformFeeRate, setPlatformFeeRate] = useState(0.05);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [payouts, setPayouts] = useState<PayoutReq[]>([]);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null);
  const [orderProfits, setOrderProfits] = useState<Array<{id: string; receiver: string; total: number; fee: number; platformFee: number; net: number; status: string}>>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Fetch merchant record, payouts, and orders in parallel
    const [merchantRes, payoutRes, ordersRes] = await Promise.all([
      supabase.from("merchants" as any).select("*").eq("user_id", user.id).single(),
      supabase.from("payout_requests").select("*").eq("merchant_id", user.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("*").eq("merchant_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    if (merchantRes.data) {
      const m = merchantRes.data as any;
      setWalletBalance(Number(m.wallet_balance || 0));
      setPlatformFeeRate(Number(m.platform_fee_rate || 0.05));
    }

    // Fallback: also try wallets table for backward compat
    if (!merchantRes.data) {
      const { data: walletData } = await supabase.from("wallets").select("*").eq("merchant_id", user.id).single();
      if (walletData) {
        setWalletBalance(Number(walletData.balance));
        const { data: t } = await supabase.from("wallet_transactions").select("*").eq("wallet_id", walletData.id).order("created_at", { ascending: false }).limit(50);
        if (t) setTxns(t as WalletTx[]);
      }
    }

    if (payoutRes.data) setPayouts(payoutRes.data as PayoutReq[]);

    // Calculate pending balance and profit table from orders
    if (ordersRes.data) {
      const inTransit = ordersRes.data.filter((o: any) => !["delivered", "returned", "cancelled"].includes(o.status));
      const pending = inTransit.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      setPendingBalance(pending);

      setOrderProfits(ordersRes.data.map((o: any) => {
        const total = Number(o.final_sale_price || o.total_amount || 0);
        const deliveryFee = Number(o.delivery_fee || 0);
        const pFee = Number(o.platform_fee || total * platformFeeRate);
        return {
          id: o.id,
          receiver: o.receiver_name,
          total,
          fee: deliveryFee,
          platformFee: pFee,
          net: total - deliveryFee - pFee,
          status: o.status,
        };
      }));
    }
  }, [user, platformFeeRate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submitPayout = async () => {
    if (!user) return;
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (amount > walletBalance) { toast.error("المبلغ يتجاوز الرصيد المتاح"); return; }
    if (!payoutMethod) { toast.error("اختر طريقة التسوية"); return; }
    if (!payoutDetails.trim()) { toast.error("أدخل تفاصيل الحساب"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("payout_requests").insert({
      merchant_id: user.id, amount, method: payoutMethod, account_details: payoutDetails.trim(),
    } as any);
    if (error) { toast.error(error.message); } else {
      toast.success("تم إرسال طلب التسوية بنجاح");
      setPayoutOpen(false); setPayoutAmount(""); setPayoutMethod(""); setPayoutDetails("");
      fetchData();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-semibold text-lg text-foreground">المحفظة</h2>
        <div className="flex gap-2">
          <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><CreditCard className="h-4 w-4" /> طلب تسوية</Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader><DialogTitle>طلب تسوية مالية</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>المبلغ (ل.س)</Label><Input type="number" min="1" max={walletBalance} value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder={`الحد الأقصى: ${walletBalance.toLocaleString()}`} /></div>
                <div className="space-y-2"><Label>طريقة التسوية</Label><Select value={payoutMethod} onValueChange={setPayoutMethod}><SelectTrigger><SelectValue placeholder="اختر الطريقة" /></SelectTrigger><SelectContent>{PAYOUT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>تفاصيل الحساب</Label><Input value={payoutDetails} onChange={e => setPayoutDetails(e.target.value)} placeholder="رقم الهاتف أو اسم الحساب" /></div>
                <Button className="w-full glow-btn" disabled={submitting} onClick={submitPayout}>{submitting ? "جاري الإرسال..." : "إرسال طلب التسوية"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Link to="/topup"><Button className="gap-2 glow-btn"><ArrowDownCircle className="h-4 w-4" /> شحن الرصيد</Button></Link>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-2 border-primary/30">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-2xl font-display font-bold text-primary">{walletBalance.toLocaleString()} ل.س</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">رصيد معلّق (طلبات قيد التوصيل)</p>
              <p className="text-2xl font-display font-bold text-warning">{pendingBalance.toLocaleString()} ل.س</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Wallet className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">العمولة ({(platformFeeRate * 100).toFixed(0)}%)</p>
              <p className="text-2xl font-display font-bold text-foreground">{(walletBalance + pendingBalance).toLocaleString()} ل.س</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Profit Table */}
      {orderProfits.length > 0 && (
        <>
          <h3 className="font-display font-semibold text-foreground">تفاصيل الأرباح (بعد العمولة)</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="p-3 text-right font-medium">العميل</th>
                    <th className="p-3 text-right font-medium">سعر البيع</th>
                    <th className="p-3 text-right font-medium">رسوم التوصيل</th>
                    <th className="p-3 text-right font-medium">عمولة المنصة</th>
                    <th className="p-3 text-right font-medium">صافي الربح</th>
                    <th className="p-3 text-right font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {orderProfits.slice(0, 20).map(o => (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 text-foreground">{o.receiver}</td>
                      <td className="p-3 text-foreground">{o.total.toLocaleString()} ل.س</td>
                      <td className="p-3 text-destructive">-{o.fee.toLocaleString()} ل.س</td>
                      <td className="p-3 text-destructive">-{o.platformFee.toLocaleString()} ل.س</td>
                      <td className={`p-3 font-bold ${o.net >= 0 ? 'text-primary' : 'text-destructive'}`}>{o.net.toLocaleString()} ل.س</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{ORDER_STATUS_AR[o.status] || o.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payouts */}
      {payouts.length > 0 && (
        <>
          <h3 className="font-display font-semibold text-foreground">طلبات التسوية</h3>
          <div className="space-y-2">
            {payouts.map(p => (
              <Card key={p.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-display font-bold text-foreground">{Number(p.amount).toLocaleString()} ل.س</p>
                    <p className="text-xs text-muted-foreground">{PAYOUT_METHODS.find(m => m.value === p.method)?.label || p.method} — {p.account_details}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.receipt_url && <Button variant="ghost" size="icon" onClick={() => setReceiptOpen(p.receipt_url)}><ImageIcon className="h-4 w-4 text-primary" /></Button>}
                    <Badge variant="outline" className={p.status === "completed" ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}>
                      {PAYOUT_STATUS_AR[p.status] || p.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!receiptOpen} onOpenChange={o => !o && setReceiptOpen(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>إيصال التحويل</DialogTitle></DialogHeader>
          {receiptOpen && <img src={receiptOpen} alt="receipt" className="rounded-lg max-h-96 object-contain mx-auto" />}
        </DialogContent>
      </Dialog>

      {/* Transaction History */}
      {txns.length > 0 && (
        <>
          <h3 className="font-display font-semibold text-foreground">سجل الحركات</h3>
          <div className="space-y-2">
            {txns.map(t => (
              <Card key={t.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {t.amount >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{TYPE_AR[t.type] || t.type}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`font-display font-bold ${t.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>{t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()} ل.س</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('ar')}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
