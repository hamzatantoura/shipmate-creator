import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Search } from "lucide-react";

const TYPE_AR: Record<string, string> = {
  topup: "شحن رصيد",
  shipping_fee: "رسوم شحن",
  cod_settlement: "تسوية COD",
  commission: "بدل تحصيل",
  carrier_adjustment: "تعديل الناقل",
  return_fee: "رسوم إرجاع",
  payout: "تسوية مالية",
};

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  wallet_id: string;
  merchant_name?: string;
}

interface Props {
  /** If provided, show only this merchant's transactions */
  merchantId?: string;
  /** If true, show all merchants' transactions (admin view) */
  showAll?: boolean;
}

export default function WalletTransactionsLog({ merchantId, showAll }: Props) {
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let walletIds: string[] = [];
      let walletMerchantMap = new Map<string, string>();

      if (showAll) {
        const { data: wallets } = await supabase.from("wallets").select("id, merchant_id");
        if (wallets) {
          walletIds = wallets.map(w => w.id);
          // Get merchant names
          const merchantIds = wallets.map(w => w.merchant_id);
          const { data: merchants } = await supabase
            .from("merchants")
            .select("user_id, store_name")
            .in("user_id", merchantIds);
          const nameMap = new Map(merchants?.map(m => [m.user_id, m.store_name]) || []);
          wallets.forEach(w => walletMerchantMap.set(w.id, nameMap.get(w.merchant_id) || "-"));
        }
      } else if (merchantId) {
        const { data: wallet } = await supabase.from("wallets").select("id").eq("merchant_id", merchantId).single();
        if (wallet) walletIds = [wallet.id];
      }

      if (walletIds.length === 0) { setTxns([]); setLoading(false); return; }

      let q = supabase
        .from("wallet_transactions")
        .select("*")
        .in("wallet_id", walletIds)
        .order("created_at", { ascending: false })
        .limit(200);

      const { data } = await q;
      setTxns((data || []).map(t => ({ ...t, merchant_name: walletMerchantMap.get(t.wallet_id) })) as WalletTx[]);
      setLoading(false);
    };
    fetch();
  }, [merchantId, showAll]);

  const filtered = search
    ? txns.filter(t => (t.description || "").includes(search) || (t.merchant_name || "").includes(search) || TYPE_AR[t.type]?.includes(search))
    : txns;

  if (loading) return <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث في الحركات..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">لا توجد حركات</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <Card key={t.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {t.amount >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{TYPE_AR[t.type] || t.type}</p>
                    {t.merchant_name && <p className="text-xs text-primary">{t.merchant_name}</p>}
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                </div>
                <div className="text-left">
                  <p className={`font-display font-bold ${t.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {t.amount >= 0 ? '+' : ''}{Number(t.amount).toLocaleString()} ل.س
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('ar')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
