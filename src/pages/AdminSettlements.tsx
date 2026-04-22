import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Receipt, Inbox } from "lucide-react";
import { toast } from "sonner";

type SettlementStatus = "pending" | "approved" | "rejected";

interface Settlement {
  id: string;
  courier_id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  status: SettlementStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  receipt_url: string | null;
  created_at: string;
  courier_name: string;
}

const STATUS_AR: Record<SettlementStatus, string> = {
  pending: "قيد المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
};

const statusBadge = (s: SettlementStatus) => {
  switch (s) {
    case "approved":
      return "bg-primary/20 text-primary border-primary/30";
    case "rejected":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-warning/20 text-warning border-warning/30";
  }
};

const fmtSYP = (n: number) =>
  new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(n) + " ل.س";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-SY", { year: "numeric", month: "short", day: "numeric" });

export default function AdminSettlements() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SettlementStatus>("pending");

  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    mode: "approve" | "reject" | null;
    settlement: Settlement | null;
  }>({ open: false, mode: null, settlement: null });
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("courier_settlements")
      .select("*, couriers(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("فشل تحميل التسويات: " + error.message);
      setLoading(false);
      return;
    }
    const mapped: Settlement[] = (data ?? []).map((r: any) => ({
      id: r.id,
      courier_id: r.courier_id,
      amount: Number(r.amount),
      payment_date: r.payment_date,
      reference: r.reference,
      notes: r.notes,
      status: (r.status as SettlementStatus) ?? "pending",
      admin_note: r.admin_note,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      receipt_url: r.receipt_url,
      created_at: r.created_at,
      courier_name: r.couriers?.name ?? "—",
    }));
    setRows(mapped);
    setLoading(false);
  }

  const filtered = useMemo(
    () => rows.filter((r) => r.status === tab),
    [rows, tab],
  );

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows],
  );

  function openAction(mode: "approve" | "reject", settlement: Settlement) {
    setAdminNote("");
    setActionDialog({ open: true, mode, settlement });
  }

  async function submitAction() {
    if (!actionDialog.settlement || !actionDialog.mode || !user) return;
    const isReject = actionDialog.mode === "reject";
    const trimmed = adminNote.trim();
    if (isReject && !trimmed) {
      toast.error("يجب إدخال سبب الرفض");
      return;
    }
    const newStatus: SettlementStatus = isReject ? "rejected" : "approved";
    const target = actionDialog.settlement;

    setSubmitting(true);
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from("courier_settlements")
      .update({
        status: newStatus,
        admin_note: trimmed || null,
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
      })
      .eq("id", target.id)
      .eq("status", "pending"); // strict: only pending can be transitioned

    setSubmitting(false);
    if (error) {
      toast.error("فشل التحديث: " + error.message);
      return;
    }

    // Optimistic update — move row to its new tab
    setRows((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? {
              ...r,
              status: newStatus,
              admin_note: trimmed || null,
              reviewed_by: user.id,
              reviewed_at: reviewedAt,
            }
          : r,
      ),
    );
    toast.success(isReject ? "تم رفض الدفعة" : "تم اعتماد الدفعة");
    setActionDialog({ open: false, mode: null, settlement: null });
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">تسويات المناديب</h1>
            <p className="text-sm text-muted-foreground">
              مراجعة واعتماد الدفعات المستلمة من شركات الشحن
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as SettlementStatus)}>
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="pending" className="gap-2">
              قيد المراجعة
              <Badge variant="secondary" className="h-5 px-1.5">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              معتمدة
              <Badge variant="secondary" className="h-5 px-1.5">{counts.approved}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              مرفوضة
              <Badge variant="secondary" className="h-5 px-1.5">{counts.rejected}</Badge>
            </TabsTrigger>
          </TabsList>

          {(["pending", "approved", "rejected"] as SettlementStatus[]).map((s) => (
            <TabsContent key={s} value={s} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {STATUS_AR[s]} ({filtered.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Inbox className="h-10 w-10 mb-2 opacity-50" />
                      <p>لا توجد تسويات في هذه القائمة</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">شركة الشحن</TableHead>
                            <TableHead className="text-right">المبلغ</TableHead>
                            <TableHead className="text-right">تاريخ الدفع</TableHead>
                            <TableHead className="text-right">المرجع</TableHead>
                            <TableHead className="text-right">ملاحظات</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                            <TableHead className="text-right">إجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{r.courier_name}</TableCell>
                              <TableCell className="font-semibold text-primary">
                                {fmtSYP(r.amount)}
                              </TableCell>
                              <TableCell>{fmtDate(r.payment_date)}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {r.reference || "—"}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                {r.notes || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusBadge(r.status)}>
                                  {STATUS_AR[r.status]}
                                </Badge>
                                {r.status !== "pending" && r.admin_note && (
                                  <div className="text-[11px] text-muted-foreground mt-1 max-w-[200px] truncate">
                                    📝 {r.admin_note}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {r.status === "pending" ? (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => openAction("approve", r)}
                                      className="gap-1"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      اعتماد
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => openAction("reject", r)}
                                      className="gap-1"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      رفض
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {r.reviewed_at ? fmtDate(r.reviewed_at) : "—"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Dialog
        open={actionDialog.open}
        onOpenChange={(o) =>
          !submitting && setActionDialog((d) => ({ ...d, open: o }))
        }
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.mode === "approve" ? "اعتماد الدفعة" : "رفض الدفعة"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.settlement && (
                <span>
                  {actionDialog.settlement.courier_name} —{" "}
                  <span className="font-semibold text-primary">
                    {fmtSYP(actionDialog.settlement.amount)}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="admin-note">
              ملاحظة الإدارة{" "}
              {actionDialog.mode === "reject" ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground text-xs">(اختياري)</span>
              )}
            </Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={
                actionDialog.mode === "reject"
                  ? "مثال: الحوالة لم تصل إلى الحساب"
                  : "ملاحظة اختيارية..."
              }
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog({ open: false, mode: null, settlement: null })
              }
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              variant={actionDialog.mode === "reject" ? "destructive" : "default"}
              onClick={submitAction}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {actionDialog.mode === "approve" ? "تأكيد الاعتماد" : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}