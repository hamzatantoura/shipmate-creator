import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { CreditCard, Upload, Image as ImageIcon, TrendingUp, Truck, Bell, ArrowDownCircle, CheckCircle, Package, Clock, ChevronDown, ChevronUp, User, MapPin, Phone, Wallet, Building2, BarChart3, MessageCircle, ScrollText, Receipt } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import AdminDistrictsManagement from "@/components/admin/AdminDistrictsManagement";
import AdminMerchantApproval from "@/components/admin/AdminMerchantApproval";
import AdminCouriersManagement from "@/components/admin/AdminCouriersManagement";
import AdminBranchesManagement from "@/components/admin/AdminBranchesManagement";
import AdminAnalyticsDashboard from "@/components/admin/AdminAnalyticsDashboard";
import AdminWhatsappQueue from "@/components/admin/AdminWhatsappQueue";
import AdminAuditLog from "@/components/admin/AdminAuditLog";
import { CourierSettlementsPanel } from "@/pages/AdminSettlements";
import WalletTransactionsLog from "@/components/shared/WalletTransactionsLog";
import SecureReceiptImage from "@/components/SecureReceiptImage";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

const STATUS_OPTIONS = [
  { value: "pending_pickup", label: "بانتظار الاستلام" },
  { value: "at_warehouse", label: "تم الاستلام / في المستودع" },
  { value: "in_transit_intercity", label: "قيد الشحن بين المحافظات" },
  { value: "with_distributor", label: "مع مندوب التوزيع" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
];
const STATUS_AR: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]));

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

interface PayoutRequest {
  id: string; merchant_id: string; amount: number; method: string;
  account_details: string; status: string; receipt_url: string | null;
  admin_note: string | null; created_at: string;
  merchant_name?: string;
  merchant_contact?: string;
  merchant_phone?: string;
}
interface TopUpRequest {
  id: string; merchant_id: string; amount: number; method: string;
  receipt_url: string | null; reference_number: string | null;
  status: string; created_at: string;
}
interface StatusLog {
  id: string; old_status: string | null; new_status: string;
  changed_by: string; created_at: string;
}

const METHOD_AR: Record<string, string> = { shamcash: "ShamCash", syriatel_cash: "سيريتل كاش", cash_office: "نقداً من المكتب", bank_transfer: "حوالة بنكية", manual_transfer: "حوالة يدوية" };
const PAY_STATUS_AR: Record<string, string> = { pending: "بانتظار المعالجة", processing: "قيد المعالجة", completed: "مكتملة" };
const payStatusColor = (s: string) => {
  switch (s) {
    case "completed": return "bg-primary/20 text-primary border-primary/30";
    case "processing": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};
const shipStatusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "returned": return "bg-destructive/20 text-destructive border-destructive/30";
    case "with_distributor": return "bg-info/20 text-info border-info/30";
    case "in_transit_intercity": return "bg-accent/20 text-accent-foreground border-accent/30";
    case "at_warehouse": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function AdminLogistics() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [topups, setTopups] = useState<TopUpRequest[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [totalShipments, setTotalShipments] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, StatusLog[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Persisted active tab — stays put across re-renders and page refreshes
  const TAB_STORAGE_KEY = "admin-active-tab";
  const VALID_TABS = ["analytics", "shipments", "topups", "payouts", "settlements", "districts", "merchants", "couriers", "branches", "transactions", "whatsapp", "audit"];
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "analytics";
    const fromUrl = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null);
    if (fromUrl && VALID_TABS.includes(fromUrl)) return fromUrl;
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
    return saved && VALID_TABS.includes(saved) ? saved : "analytics";
  });
  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);
  // Keep the URL in sync with the selected tab (without polluting history)
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  // React to external URL changes (e.g. user clicks a link that changes ?tab=)
  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && VALID_TABS.includes(fromUrl) && fromUrl !== activeTab) {
      setActiveTab(fromUrl);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingTopups = topups.filter(t => t.status === "pending").length;
  const pendingPayouts = payouts.filter(p => p.status === "pending").length;
  const [pendingSettlements, setPendingSettlements] = useState(0);
  const totalPending = pendingTopups + pendingPayouts + pendingSettlements;

  const fetchData = async () => {
    const [pRes, tRes, sAllRes, sActiveRes, platformWalletRes] = await Promise.all([
      supabase.from("payout_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("top_up_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("shipments").select("status"),
      supabase.from("shipments").select("*").not("status", "in", '("delivered","returned")').order("created_at", { ascending: false }),
      supabase.from("wallets").select("balance").eq("merchant_id", "00000000-0000-0000-0000-000000000001").maybeSingle(),
    ]);
    if (pRes.data) {
      const merchantIds = [...new Set(pRes.data.map((p) => p.merchant_id).filter(Boolean))];
      const { data: merchants } = merchantIds.length
        ? await supabase
            .from("merchants")
            .select("user_id, store_name, contact_person, phone")
            .in("user_id", merchantIds)
        : { data: [] };

      const merchantMap = new Map(
        (merchants ?? []).map((merchant) => [merchant.user_id, merchant]),
      );

      setPayouts(
        pRes.data.map((payout) => {
          const merchant = merchantMap.get(payout.merchant_id);

          return {
            ...payout,
            merchant_name: merchant?.store_name || "—",
            merchant_contact: merchant?.contact_person || "—",
            merchant_phone: merchant?.phone || "—",
          };
        }) as PayoutRequest[],
      );
    }
    if (tRes.data) setTopups(tRes.data as TopUpRequest[]);
    if (sAllRes.data) {
      setTotalShipments(sAllRes.data.length);
      const delivered = sAllRes.data.filter(s => s.status === "delivered").length;
      setDeliveredCount(delivered);
    }
    // Platform earnings come from the platform wallet ledger (handled by trigger)
    if (platformWalletRes?.data) {
      setTotalProfit(Number((platformWalletRes.data as any).balance) || 0);
    }
    if (sActiveRes.data) setShipments(sActiveRes.data);
  };

  const fetchPendingSettlements = async () => {
    const { count } = await supabase
      .from("courier_settlements")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingSettlements(count ?? 0);
  };

  useEffect(() => { fetchData(); fetchPendingSettlements(); }, []);

  // Payout handlers
  const updatePayoutStatus = async () => {
    if (!selectedPayout || !newStatus) return;
    const { error } = await supabase.rpc("complete_payout", {
      p_payout_id: selectedPayout.id,
      p_new_status: newStatus,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث حالة طلب التسوية");
    setSelectedPayout(null); setNewStatus(""); fetchData();
  };

  const uploadReceipt = async (file: File) => {
    if (!selectedPayout) return;
    setUploading(true);
    // Admin RLS allows arbitrary paths in the private `uploads` bucket; group payout
    // receipts under their own prefix.
    const path = `payouts/${selectedPayout.id}_${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error("فشل رفع الإيصال"); setUploading(false); return; }
    await supabase.from("payout_requests").update({ receipt_url: path } as any).eq("id", selectedPayout.id);
    toast.success("تم رفع إيصال التحويل");
    setUploading(false); fetchData();
    setSelectedPayout({ ...selectedPayout, receipt_url: path });
  };

  const approveTopUp = async (topup: TopUpRequest) => {
    const { error } = await supabase.rpc("approve_top_up", { p_topup_id: topup.id } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم شحن ${topup.amount.toLocaleString()} ل.س للتاجر`);
    fetchData();
  };

  // Shipment status handlers (merged from carrier portal)
  const loadHistory = async (shipmentId: string) => {
    if (expandedId === shipmentId) { setExpandedId(null); return; }
    const { data } = await supabase.from("shipment_status_history").select("*").eq("shipment_id", shipmentId).order("created_at", { ascending: false });
    if (data) setHistoryMap(prev => ({ ...prev, [shipmentId]: data as StatusLog[] }));
    setExpandedId(shipmentId);
  };

  const updateShipmentStatus = async (shipment: Shipment) => {
    const ns = statusMap[shipment.id];
    if (!ns || ns === shipment.status) return;
    setUpdatingId(shipment.id);

    await supabase.from("shipment_status_history").insert({
      shipment_id: shipment.id, old_status: shipment.status, new_status: ns, changed_by: "admin",
    } as any);
    // Trigger handle_shipment_wallet_settlement performs all financial moves automatically
    const { error: upErr } = await supabase.from("shipments").update({ status: ns }).eq("id", shipment.id);
    if (upErr) {
      toast.error(upErr.message);
    } else if (ns === "delivered") {
      toast.success("تم التسليم — سيتم تسوية المبلغ تلقائياً");
    } else if (ns === "returned") {
      toast.success("تم تسجيل المرتجع — سيتم تطبيق سياسة الإرجاع تلقائياً");
    } else {
      toast.success(`تم تحديث الحالة إلى: ${STATUS_AR[ns] || ns}`);
    }
    setUpdatingId(null);
    setStatusMap(prev => ({ ...prev, [shipment.id]: "" }));
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> الإحصائيات
            </TabsTrigger>
            <TabsTrigger value="shipments" className="gap-1.5">
              <Package className="h-3.5 w-3.5" /> إدارة الشحنات
              {shipments.length > 0 && <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0 mr-1">{shipments.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="topups" className="gap-1.5">
              <ArrowDownCircle className="h-3.5 w-3.5" /> طلبات شحن الرصيد
              {pendingTopups > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 mr-1">{pendingTopups}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> طلبات التسوية
              {pendingPayouts > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 mr-1">{pendingPayouts}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="settlements" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> تسويات المناديب
              {pendingSettlements > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 mr-1">{pendingSettlements}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="districts" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> إدارة المناطق
            </TabsTrigger>
            <TabsTrigger value="merchants" className="gap-1.5">
              <User className="h-3.5 w-3.5" /> التجار
            </TabsTrigger>
            <TabsTrigger value="couriers" className="gap-1.5">
              <Truck className="h-3.5 w-3.5" /> شركات الشحن
            </TabsTrigger>
            <TabsTrigger value="branches" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> فروع الشحن
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> سجل الحركات
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> رسائل الواتساب
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> سجل التدقيق
            </TabsTrigger>
          </TabsList>

          {/* Analytics dashboard tab */}
          <TabsContent value="analytics" className="mt-4">
            <AdminAnalyticsDashboard />
          </TabsContent>

          {/* WhatsApp queue monitoring */}
          <TabsContent value="whatsapp" className="mt-4">
            <AdminWhatsappQueue />
          </TabsContent>

          {/* Shipments management tab */}
          <TabsContent value="shipments" className="mt-4">
            {shipments.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">لا توجد شحنات نشطة</p>
            ) : (
              <div className="space-y-3">
                {shipments.map(s => (
                  <Card key={s.id} className="bg-card border-border overflow-hidden">
                    <CardContent className="p-0">
                      <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between border-b border-border">
                        <span className="font-mono text-xs text-muted-foreground">{s.tracking_number}</span>
                        <Badge variant="outline" className={shipStatusColor(s.status)}>{STATUS_AR[s.status] || s.status}</Badge>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-foreground">{s.receiver_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground" dir="ltr">{s.phone_number}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <span className="text-sm font-medium text-foreground">{CITY_AR[s.city] || s.city}</span>
                            <p className="text-xs text-muted-foreground">{s.detailed_address}</p>
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded-md px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">COD</span>
                          <span className="font-display font-bold text-foreground">{Number(s.cod_amount).toLocaleString()} ل.س</span>
                        </div>
                      </div>
                      <div className="px-4 pb-3 flex gap-2">
                        <Select value={statusMap[s.id] || ""} onValueChange={v => setStatusMap(prev => ({ ...prev, [s.id]: v }))}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="تغيير الحالة..." /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter(o => o.value !== s.status).map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button disabled={!statusMap[s.id] || updatingId === s.id} onClick={() => updateShipmentStatus(s)}>تحديث</Button>
                      </div>
                      <div className="border-t border-border">
                        <button className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => loadHistory(s.id)}>
                          <Clock className="h-3 w-3" /> سجل الحالات
                          {expandedId === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {expandedId === s.id && (
                          <div className="px-4 pb-3 space-y-1">
                            {(historyMap[s.id] || []).length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">لا يوجد سجل بعد</p>
                            ) : (historyMap[s.id] || []).map(h => (
                              <div key={h.id} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground w-16 shrink-0">{new Date(h.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString("ar")}</span>
                                <span className="text-foreground">{STATUS_AR[h.old_status || ""] || h.old_status || "—"} → {STATUS_AR[h.new_status] || h.new_status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

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
                        <TableCell>{t.reference_number || "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("ar")}</TableCell>
                        <TableCell><Badge variant="outline" className={payStatusColor(t.status)}>{PAY_STATUS_AR[t.status] || t.status}</Badge></TableCell>
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
                        <p className="text-sm text-foreground font-medium">{p.merchant_name || "—"} — {p.merchant_phone || "—"}</p>
                        <p className="text-sm text-muted-foreground">{METHOD_AR[p.method] || p.method}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.receipt_url && <ImageIcon className="h-4 w-4 text-primary" />}
                        <Badge variant="outline" className={payStatusColor(p.status)}>{PAY_STATUS_AR[p.status] || p.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          {/* Heavy tabs: keep mounted across tab switches so open dialogs and unsaved
              form state are preserved when the admin briefly visits another tab. */}
          <TabsContent value="districts" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AdminDistrictsManagement />
          </TabsContent>
          <TabsContent value="merchants" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AdminMerchantApproval />
          </TabsContent>
          <TabsContent value="couriers" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AdminCouriersManagement />
          </TabsContent>
          <TabsContent value="branches" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AdminBranchesManagement />
          </TabsContent>
          <TabsContent value="transactions" forceMount className="mt-4 data-[state=inactive]:hidden">
            <WalletTransactionsLog showAll />
          </TabsContent>
          <TabsContent value="audit" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AdminAuditLog />
          </TabsContent>
          <TabsContent value="settlements" forceMount className="mt-4 data-[state=inactive]:hidden">
            <CourierSettlementsPanel />
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
                  <div className="col-span-2"><span className="text-muted-foreground">اسم المتجر:</span> <span className="font-bold">{selectedPayout.merchant_name || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">اسم البائع:</span> <span className="font-bold">{selectedPayout.merchant_contact || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">رقم الهاتف:</span> <span className="font-bold">{selectedPayout.merchant_phone || "—"}</span></div>
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
                  {selectedPayout.receipt_url ? <SecureReceiptImage source={selectedPayout.receipt_url} /> : <p className="text-xs text-muted-foreground">لم يتم رفع إيصال بعد</p>}
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
            {receiptPreview && (
              <SecureReceiptImage
                source={receiptPreview}
                className="rounded-lg max-h-96 object-contain mx-auto"
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
