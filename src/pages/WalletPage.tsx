import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import NavLink from "@/components/NavLink";

const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";

const TYPE_AR: Record<string, string> = {
  topup: "شحن رصيد",
  shipping_fee: "رسوم شحن",
  cod_settlement: "تسوية COD",
  commission: "عمولة المنصة",
  carrier_adjustment: "تعديل الناقل",
};

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<WalletTx[]>([]);

  const fetch = async () => {
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
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <NavLink />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">المحفظة</h1>
          <Link to="/topup">
            <Button className="gap-2"><ArrowDownCircle className="h-4 w-4" /> شحن الرصيد</Button>
          </Link>
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
