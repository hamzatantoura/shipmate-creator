import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPE_META: Record<string, { label: string; tone: string }> = {
  topup:               { label: "شحن رصيد",        tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20" },
  shipping_fee:        { label: "أجرة الشحن",       tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  cod_settlement:      { label: "قيمة COD",         tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  commission:          { label: "عمولة / تحصيل",    tone: "bg-primary/10 text-primary border-primary/20" },
  carrier_adjustment:  { label: "تعديل الناقل",     tone: "bg-muted text-muted-foreground border-border" },
  return_fee:          { label: "رسوم إرجاع",       tone: "bg-destructive/10 text-destructive border-destructive/20" },
  payout:              { label: "تسوية مالية",      tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20" },
};

const silaCodeOf = (id?: string | null) => (id ? "SL-" + id.slice(0, 6).toUpperCase() : "—");

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  wallet_id: string;
  reference_id: string | null;
  merchant_name?: string;
}

interface Props {
  /** If provided, show only this merchant's transactions */
  merchantId?: string;
  /** If true, show all merchants' transactions (admin view) */
  showAll?: boolean;
  /** If provided, show only transactions for orders/shipments assigned to one of this vendor's couriers */
  vendorId?: string;
}

export default function WalletTransactionsLog({ merchantId, showAll, vendorId }: Props) {
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "credit" | "debit" | "return_fee" | "cod_settlement">("all");
  const [detail, setDetail] = useState<WalletTx | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      // ===== Courier (vendor) scope: fetch txns linked to orders / shipments
      // assigned to one of this vendor's couriers. RLS enforces this server-side too.
      if (vendorId) {
        const { data: courierRows } = await supabase
          .from("couriers")
          .select("id")
          .eq("vendor_id", vendorId);
        const courierIds = (courierRows || []).map(c => c.id);
        if (courierIds.length === 0) {
          setTxns([]); setLoading(false); return;
        }
        const [{ data: orderRows }, { data: shipRows }] = await Promise.all([
          supabase.from("orders").select("id").in("courier_id", courierIds),
          supabase.from("shipments").select("id").in("courier_id", courierIds),
        ]);
        const refIds = [
          ...((orderRows || []).map(o => o.id)),
          ...((shipRows || []).map(s => s.id)),
        ];
        if (refIds.length === 0) { setTxns([]); setLoading(false); return; }
        const { data } = await supabase
          .from("wallet_transactions")
          .select("*")
          .in("reference_id", refIds)
          .order("created_at", { ascending: false })
          .limit(200);
        setTxns((data || []) as WalletTx[]);
        setLoading(false);
        return;
      }

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
  }, [merchantId, showAll, vendorId]);

  const filteredByType = txns.filter(t => {
    const amt = Number(t.amount);
    if (filter === "credit") return amt >= 0;
    if (filter === "debit") return amt < 0;
    if (filter === "return_fee") return t.type === "return_fee";
    if (filter === "cod_settlement") return t.type === "cod_settlement";
    return true;
  });
  const filtered = search
    ? filteredByType.filter(t =>
        (t.description || "").includes(search)
        || (t.merchant_name || "").includes(search)
        || TYPE_META[t.type]?.label.includes(search)
        || silaCodeOf(t.reference_id).toLowerCase().includes(search.toLowerCase())
      )
    : filteredByType;

  const totals = filtered.reduce(
    (acc, t) => {
      const a = Number(t.amount);
      if (a >= 0) acc.credit += a;
      else acc.debit += Math.abs(a);
      return acc;
    },
    { credit: 0, debit: 0 },
  );
  const net = totals.credit - totals.debit;

  if (loading) return <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">إجمالي الدائن</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{totals.credit.toLocaleString("ar-SY")} ل.س</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">إجمالي المدين</p>
          <p className="text-sm font-bold text-destructive tabular-nums">-{totals.debit.toLocaleString("ar-SY")} ل.س</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">الصافي</p>
          <p className={`text-sm font-bold tabular-nums ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {net >= 0 ? "+" : ""}{net.toLocaleString("ar-SY")} ل.س
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="credit">دائن</TabsTrigger>
          <TabsTrigger value="debit">مدين</TabsTrigger>
          <TabsTrigger value="cod_settlement">تسويات</TabsTrigger>
          <TabsTrigger value="return_fee">مرتجعات</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث برمز الطلب، النوع، أو الوصف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">لا توجد حركات</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const meta = TYPE_META[t.type] || { label: t.type, tone: "bg-muted text-muted-foreground border-border" };
            const isCredit = Number(t.amount) >= 0;
            const sila = silaCodeOf(t.reference_id);
            const isReturn = t.type === "return_fee";
            return (
              <Card
                key={t.id}
                className={`bg-card hover:border-primary/30 transition-colors cursor-pointer ${
                  isReturn ? "border-destructive/40 bg-destructive/5" : "border-border"
                }`}
                onClick={() => setDetail(t)}
              >
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${
                      isCredit
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] font-medium ${meta.tone}`}>
                          {meta.label}
                        </Badge>
                        {t.reference_id && (
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {sila}
                          </span>
                        )}
                      </div>
                      {t.merchant_name && (
                        <p className="text-xs text-primary mt-0.5 truncate">{t.merchant_name}</p>
                      )}
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left">
                      <p className={`font-bold tabular-nums text-sm ${
                        isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}>
                        {isCredit ? "+" : ""}{Number(t.amount).toLocaleString("ar-SY")} ل.س
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {isCredit ? "دائن" : "مدين"} · {new Date(t.created_at).toLocaleDateString("ar-SY")}
                      </p>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل الحركة</DialogTitle>
            <DialogDescription>معلومات كاملة عن العملية المالية</DialogDescription>
          </DialogHeader>
          {detail && (() => {
            const meta = TYPE_META[detail.type] || { label: detail.type, tone: "" };
            const amt = Number(detail.amount);
            const isCredit = amt >= 0;
            return (
              <div className="space-y-3 text-sm">
                <Row label="النوع" value={<Badge variant="outline" className={meta.tone}>{meta.label}</Badge>} />
                <Row label="المبلغ" value={
                  <span className={`font-bold tabular-nums ${isCredit ? "text-emerald-600" : "text-destructive"}`}>
                    {isCredit ? "+" : ""}{amt.toLocaleString("ar-SY")} ل.س
                  </span>
                } />
                <Row label="الاتجاه" value={isCredit ? "إضافة (دائن)" : "خصم (مدين)"} />
                {detail.reference_id && (
                  <Row label="رمز الطلب" value={<span className="font-mono text-xs">{silaCodeOf(detail.reference_id)}</span>} />
                )}
                <Row label="التاريخ" value={new Date(detail.created_at).toLocaleString("ar-SY")} />
                {detail.description && <Row label="الوصف" value={detail.description} />}
                {/* removed return_fee notice */}
                {detail.reference_id && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={`/merchant/orders?focus=${detail.reference_id}`}>عرض الطلب الأصلي</a>
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
