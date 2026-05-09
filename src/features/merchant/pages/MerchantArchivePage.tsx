import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MerchantSidebar } from "@/features/merchant/components/MerchantSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive, RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getOrderStatusMeta } from "@/features/shipments/lib/order-status";

interface ArchivedOrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  status: string;
  total_amount: number;
  final_sale_price: number | null;
  created_at: string;
  deleted_at: string | null;
  notes: string | null;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";
const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();
const fmtDate = (d: string) => new Date(d).toLocaleDateString("ar-SY", { year: "numeric", month: "short", day: "numeric" });

export default function MerchantArchivePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const PAGE_SIZE = 20;

  const archiveQuery = useQuery({
    queryKey: ["merchant-archive", user?.id, page],
    enabled: !!user?.id,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("orders")
        .select(
          "id, receiver_name, phone_number, city, status, total_amount, final_sale_price, created_at, deleted_at, notes",
          { count: "exact" }
        )
        .eq("merchant_id", user!.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []) as ArchivedOrderRow[], total: count ?? 0 };
    },
  });

  const rows = archiveQuery.data?.rows ?? [];
  const total = archiveQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleRestore = async () => {
    if (!restoreId) return;
    setRestoring(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "new", deleted_at: null } as any)
      .eq("id", restoreId);
    setRestoring(false);
    if (error) {
      toast.error("تعذّر استعادة الطلب: " + error.message);
      return;
    }
    toast.success("تمت استعادة الطلب إلى قائمة الطلبات النشطة");
    setRestoreId(null);
    queryClient.invalidateQueries({ queryKey: ["merchant-archive", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["merchant-orders", user?.id] });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <MerchantSidebar />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Archive className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl md:text-2xl font-bold">أرشيف الطلبات</h1>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/merchant/orders">→ الطلبات النشطة</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            هنا تجد الطلبات التي قمت بإلغائها أو حذفها. يمكنك مراجعتها أو استعادتها متى شئت — لا يتم حذف أي بيانات نهائياً للحفاظ على السجلات المالية.
          </p>

          <Card className="overflow-hidden">
            {archiveQuery.isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>الأرشيف فارغ — لم تقم بحذف أو إلغاء أي طلب بعد.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رمز التتبع</TableHead>
                    <TableHead className="text-right">المستلم</TableHead>
                    <TableHead className="text-right">المدينة</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">تاريخ الحذف</TableHead>
                    <TableHead className="text-center">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => {
                    const meta = getOrderStatusMeta(o.status as any);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{silaCodeOf(o.id)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{o.receiver_name}</div>
                          <div className="text-xs text-muted-foreground" dir="ltr">{o.phone_number}</div>
                        </TableCell>
                        <TableCell>{o.city}</TableCell>
                        <TableCell>{fmtSYP(Number(o.final_sale_price ?? o.total_amount))}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.deleted_at ? fmtDate(o.deleted_at) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRestoreId(o.id)}
                            className="gap-1"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            استعادة
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">
                صفحة {page + 1} من {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          <AlertDialog open={!!restoreId} onOpenChange={(open) => !open && setRestoreId(null)}>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>استعادة الطلب؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيعود هذا الطلب إلى قائمة الطلبات النشطة بحالة "جديد" ويمكنك تعديله أو طباعة بوليصته من جديد.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={restoring}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestore} disabled={restoring}>
                  {restoring ? "جاري الاستعادة..." : "استعادة"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>
    </SidebarProvider>
  );
}