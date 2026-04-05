import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, ArrowDownCircle, TrendingDown, TrendingUp, CreditCard, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";

const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";

const TYPE_AR: Record<string, string> = {
  topup: "شحن رصيد",
  shipping_fee: "رسوم شحن",
  cod_settlement: "تسوية COD",
  commission: "عمولة المنصة",
  carrier_adjustment: "تعديل الناقل",
  return_fee: "رسوم إرجاع",
  payout: "تسوية مالية",
};

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

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface PayoutReq {
  id: string;
  amount: number;
  method: string;
  account_details: string;
  status: string;
  receipt_url: string | null;
  created_at: string;
}

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [payouts, setPayouts] = useState<PayoutReq[]>([]);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: w } = await supabase
      .from("wallets")
      .select("*")
      .eq("merchant_id", MERCHANT_ID)
      .single();
    if (w) setBalance(Number(w.balance));

    const { data: wData } = await supabase
      .from("wallets")
      .select("id")
      .eq("merchant_id", MERCHANT_ID)
      .single();
    if (wData) {
      const { data: t } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wData.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (t) setTxns(t as WalletTx[]);
    }

    const { data: p } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("merchant_id", MERCHANT_ID)
      .order("created_at", { ascending: false });
    if (p) setPayouts(p as PayoutReq[]);
  };

  useEffect(() => { fetchData(); }, []);

  const submitPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (amount > balance) { toast.error("المبلغ يتجاوز الرصيد المتاح"); return; }
    if (!payoutMethod) { toast.error("اختر طريقة التسوية"); return; }
    if (!payoutDetails.trim()) { toast.error("أدخل تفاصيل الحساب"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("payout_requests").insert({
      merchant_id: MERCHANT_ID,
      amount,
      method: payoutMethod,
      account_details: payoutDetails.trim(),
    } as any);

    if (error) { toast.error(error.message); } else {
      toast.success("تم إرسال طلب التسوية بنجاح");
      setPayoutOpen(false);
      setPayoutAmount("");
      setPayoutMethod("");
      setPayoutDetails("");
      fetchData();
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">المحفظة</h1>
          <div className="flex gap-2">
            <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CreditCard className="h-4 w-4" /> طلب تسوية مالية
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle>طلب تسوية مالية</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>المبلغ (ل.س)</Label>
                    <Input
                      type="number"
                      min="1"
                      max={balance}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      placeholder={`الحد الأقصى: ${balance.toLocaleString()}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>طريقة التسوية</Label>
                    <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الطريقة" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYOUT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>تفاصيل الحساب (رقم الهاتف / الاسم)</Label>
                    <Input
                      value={payoutDetails}
                      onChange={(e) => setPayoutDetails(e.target.value)}
                      placeholder="رقم الهاتف أو اسم الحساب"
                    />
                  </div>
                  <Button className="w-full" disabled={submitting} onClick={submitPayout}>
                    {submitting ? "جاري الإرسال..." : "إرسال طلب التسوية"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Link to="/topup">
              <Button className="gap-2"><ArrowDownCircle className="h-4 w-4" /> شحن الرصيد</Button>
            </Link>
          </div>
        </div>

        <Card className={`border-2 ${balance >= 0 ? 'border-primary/30' : 'border-destructive/30'}`}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${balance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
              <Wallet className={`h-7 w-7 ${balance >= 0 ? 'text-primary' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
              <p className={`text-3xl font-display font-bold ${balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {balance.toLocaleString()} ل.س
              </p>
              {balance < 0 && <p className="text-xs text-destructive mt-1">لديك دَين مستحق</p>}
            </div>
          </CardContent>
        </Card>

        {/* Payout requests */}
        {payouts.length > 0 && (
          <>
            <h2 className="font-display font-semibold text-lg text-foreground">طلبات التسوية</h2>
            <div className="space-y-2">
              {payouts.map((p) => (
                <Card key={p.id} className="bg-card border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-foreground">{Number(p.amount).toLocaleString()} ل.س</p>
                      <p className="text-xs text-muted-foreground">
                        {PAYOUT_METHODS.find((m) => m.value === p.method)?.label || p.method} — {p.account_details}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.receipt_url && (
                        <Button variant="ghost" size="icon" onClick={() => setReceiptOpen(p.receipt_url)}>
                          <ImageIcon className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Badge variant="outline" className={
                        p.status === "completed" ? "bg-primary/20 text-primary border-primary/30" :
                        p.status === "processing" ? "bg-warning/20 text-warning border-warning/30" :
                        "bg-muted text-muted-foreground border-border"
                      }>
                        {PAYOUT_STATUS_AR[p.status] || p.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Receipt viewer */}
        <Dialog open={!!receiptOpen} onOpenChange={(o) => !o && setReceiptOpen(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إيصال التحويل</DialogTitle>
            </DialogHeader>
            {receiptOpen && <img src={receiptOpen} alt="receipt" className="rounded-lg max-h-96 object-contain mx-auto" />}
          </DialogContent>
        </Dialog>

        <h2 className="font-display font-semibold text-lg text-foreground">سجل الحركات</h2>
        {txns.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">لا توجد حركات بعد</p>
        ) : (
          <div className="space-y-2">
            {txns.map(t => (
              <Card key={t.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {t.amount >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-primary" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{TYPE_AR[t.type] || t.type}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`font-display font-bold ${t.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()} ل.س
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('ar')}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}