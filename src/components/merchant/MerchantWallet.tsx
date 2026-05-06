import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, ArrowDownCircle, CreditCard, Image as ImageIcon, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import WalletTransactionsLog from "@/components/shared/WalletTransactionsLog";
import { usePlatformSettings } from "@/hooks/use-platform-settings";

const PAYOUT_METHODS = [
  { value: "shamcash", label: "ShamCash" },
  { value: "syriatel_cash", label: "سيريتل كاش" },
  { value: "cash_office", label: "نقداً من المكتب" },
  { value: "bank_transfer", label: "حوالة بنكية" },
];

const PAYOUT_STATUS_AR: Record<string, string> = {
  pending: "بانتظار المعالجة",
  processing: "قيد المعالجة",
  completed: "مكتملة",
};

interface PayoutReq {
  id: string;
  amount: number;
  method: string;
  account_details: string;
  status: string;
  receipt_url: string | null;
  created_at: string;
}

export default function MerchantWallet() {
  const { user } = useAuth();
  const { settings: platformSettings } = usePlatformSettings();
  const minPayout = platformSettings.min_payout_amount || 0;
  const [walletBalance, setWalletBalance] = useState(0); // legacy ledger balance (kept for payout cap)
  const [availableBalance, setAvailableBalance] = useState(0); // delivered orders
  const [pendingBalance, setPendingBalance] = useState(0); // processing/shipped/out_for_delivery
  const [payouts, setPayouts] = useState<PayoutReq[]>([]);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null);

  const expectedBalance = availableBalance + pendingBalance;

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [walletRes, payoutRes, ordersRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("merchant_id", user.id).single(),
      supabase.from("payout_requests").select("*").eq("merchant_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("status, total_amount, final_sale_price, delivery_fee")
        .eq("merchant_id", user.id)
        .is("deleted_at", null),
    ]);

    if (walletRes.data) {
      const { data: t } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("wallet_id", walletRes.data.id)
        .order("created_at", { ascending: false });
      // Available balance = sum of ledger (single source of truth)
      const ledgerSum = (t || []).reduce((s: number, x: any) => s + Number(x.amount), 0);
      setWalletBalance(ledgerSum);
      setAvailableBalance(ledgerSum);
    }

    if (payoutRes.data) setPayouts(payoutRes.data as PayoutReq[]);

    // Pending = orders not yet delivered (informational only, not part of available balance)
    if (ordersRes.data) {
      const PENDING = new Set(["processing", "shipped", "out_for_delivery"]);
      let pend = 0;
      for (const o of ordersRes.data as any[]) {
        const amount = Number(o.final_sale_price ?? o.total_amount ?? 0);
        const fee = Number(o.delivery_fee ?? 0);
        const net = amount - fee;
        if (PENDING.has(o.status)) pend += net;
      }
      setPendingBalance(pend);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: refresh balances when any of merchant's orders change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${user.id}` },
        () => fetchData(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const submitPayout = async () => {
    if (!user) return;
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (amount > walletBalance) { toast.error("المبلغ يتجاوز الرصيد المتاح"); return; }
    if (amount < minPayout) { toast.error(`الحد الأدنى للسحب ${minPayout.toLocaleString()} ل.س`); return; }
    if (!payoutMethod) { toast.error("اختر طريقة التسوية"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("payout_requests").insert({
      merchant_id: user.id, amount, method: payoutMethod, account_details: "-",
    } as any);
    if (error) { toast.error(error.message); } else {
      toast.success("تم إرسال طلب التسوية بنجاح");
      setPayoutOpen(false); setPayoutAmount(""); setPayoutMethod("");
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
              <Button variant="outline" className="gap-2" disabled={walletBalance <= 0}>
                <CreditCard className="h-4 w-4" /> طلب تسوية
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader><DialogTitle>طلب تسوية مالية</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>المبلغ (ل.س)</Label>
                  <Input type="number" min="1" max={walletBalance} value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder={`الحد الأقصى: ${walletBalance.toLocaleString()}`} />
                </div>
                <div className="space-y-2">
                  <Label>طريقة التسوية</Label>
                  <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                    <SelectTrigger><SelectValue placeholder="اختر الطريقة" /></SelectTrigger>
                    <SelectContent>{PAYOUT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button className="w-full glow-btn" disabled={submitting} onClick={submitPayout}>
                  {submitting ? "جاري الإرسال..." : "إرسال طلب التسوية"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Link to="/topup"><Button className="gap-2 glow-btn"><ArrowDownCircle className="h-4 w-4" /> شحن الرصيد</Button></Link>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={`border-2 ${availableBalance >= 0 ? 'border-primary/30' : 'border-destructive/30'}`}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${availableBalance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
              {availableBalance >= 0 ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <AlertTriangle className="h-6 w-6 text-destructive" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className={`text-2xl font-display font-bold ${availableBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {availableBalance.toLocaleString()} ل.س
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">الطلبات المُسلَّمة (صافي بعد الشحن)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">بانتظار التحويل</p>
              <p className="text-2xl font-display font-bold text-warning">{pendingBalance.toLocaleString()} ل.س</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">قيد المعالجة / الشحن / التوصيل</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Wallet className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الرصيد المتوقع</p>
              <p className="text-2xl font-display font-bold text-foreground">{expectedBalance.toLocaleString()} ل.س</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">المتاح + بانتظار التحويل</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar")}</p>
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
      <h3 className="font-display font-semibold text-foreground">سجل الحركات</h3>
      {user && <WalletTransactionsLog merchantId={user.id} />}
    </div>
  );
}
