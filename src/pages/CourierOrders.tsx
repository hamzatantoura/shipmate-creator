import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Package, LogOut, RefreshCw } from "lucide-react";
import silaLogo from "@/assets/sila-logo.png";

interface CourierOrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  status: string;
  total_amount: number;
  final_sale_price: number | null;
  delivery_fee: number;
  created_at: string;
  notes: string | null;
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "جديد", variant: "outline" },
  processing: { label: "قيد المعالجة", variant: "secondary" },
  shipped: { label: "تم الشحن", variant: "secondary" },
  out_for_delivery: { label: "قيد التوصيل", variant: "default" },
  delivered: { label: "تم التسليم", variant: "default" },
  returned: { label: "مرتجع", variant: "destructive" },
  cancelled: { label: "ملغي", variant: "destructive" },
};

const NEXT_STATUSES = [
  { value: "out_for_delivery", label: "قيد التوصيل" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
];

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";
const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();

export default function CourierOrders() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<CourierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // RLS handles courier_id scoping — courier sees only orders assigned to their courier company record
    const { data, error } = await supabase
      .from("orders")
      .select("id, receiver_name, phone_number, city, detailed_address, status, total_amount, final_sale_price, delivery_fee, created_at, notes")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر تحميل الطلبات");
    else setOrders((data || []) as CourierOrderRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime updates for assignments / status changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`courier-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchOrders]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", id);
    setUpdatingId(null);
    if (error) {
      toast.error(error.message || "تعذر تحديث الحالة");
      return;
    }
    toast.success("تم تحديث الحالة");
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/courier/orders" className="flex items-center gap-2">
            <img src={silaLogo} alt="Sila" className="h-7 w-7" />
            <span className="font-bold text-lg text-primary">Sila — بوابة شركة الشحن</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchOrders} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">تحديث</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            الطلبات المسندة إلينا
          </h1>
          <Badge variant="secondary">{orders.length} طلب</Badge>
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              لا توجد طلبات مسندة لشركتكم حالياً
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>المستلم</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>قيمة COD</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-[200px]">تحديث الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const meta = STATUS_META[o.status] || { label: o.status, variant: "outline" as const };
                  const cod = o.final_sale_price ?? o.total_amount;
                  const isFinal = ["delivered", "returned", "cancelled"].includes(o.status);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{silaCodeOf(o.id)}</TableCell>
                      <TableCell className="font-medium">{o.receiver_name}</TableCell>
                      <TableCell dir="ltr" className="text-xs">{o.phone_number}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="text-sm">{o.city}</div>
                        <div className="text-xs text-muted-foreground truncate">{o.detailed_address}</div>
                      </TableCell>
                      <TableCell className="font-semibold">{fmtSYP(Number(cod))}</TableCell>
                      <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                      <TableCell>
                        {isFinal ? (
                          <span className="text-xs text-muted-foreground">حالة نهائية</span>
                        ) : (
                          <Select
                            value={o.status}
                            onValueChange={(v) => updateStatus(o.id, v)}
                            disabled={updatingId === o.id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="اختر حالة" />
                            </SelectTrigger>
                            <SelectContent>
                              {NEXT_STATUSES.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </div>
  );
}
