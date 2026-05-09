import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LifeBuoy, Search, Loader2, CheckCircle2, AlertOctagon, Clock } from "lucide-react";
import { toast } from "sonner";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  merchant_name?: string;
  merchant_phone?: string;
}

const STATUS_AR: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد المعالجة", resolved: "محلولة", closed: "مغلقة",
};
const PRIORITY_AR: Record<string, string> = {
  low: "منخفضة", normal: "عادية", high: "مرتفعة", urgent: "عاجلة",
};
const CATEGORY_AR: Record<string, string> = {
  general: "عام", billing: "محاسبة", shipment: "شحنات", technical: "تقني", account: "حساب",
};

const statusBadge = (s: string) => {
  switch (s) {
    case "resolved": return "bg-success/15 text-success border-success/30";
    case "in_progress": return "bg-info/15 text-info border-info/30";
    case "closed": return "bg-muted text-muted-foreground border-border";
    default: return "bg-warning/15 text-warning border-warning/30";
  }
};
const priorityBadge = (p: string) => {
  switch (p) {
    case "urgent": return "bg-destructive/15 text-destructive border-destructive/30";
    case "high": return "bg-warning/15 text-warning border-warning/30";
    case "low": return "bg-muted text-muted-foreground border-border";
    default: return "bg-primary/10 text-primary border-primary/20";
  }
};

export default function AdminSupportTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذّر تحميل التذاكر");
      setLoading(false);
      return;
    }
    const rows = (data || []) as unknown as Ticket[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length) {
      const { data: merchants } = await supabase
        .from("merchants")
        .select("user_id, store_name, phone")
        .in("user_id", userIds);
      const map = new Map((merchants || []).map((m) => [m.user_id, m]));
      for (const t of rows) {
        const m = map.get(t.user_id);
        t.merchant_name = m?.store_name || "—";
        t.merchant_phone = m?.phone || "—";
      }
    }
    setTickets(rows);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${t.subject} ${t.message} ${t.merchant_name || ""} ${t.merchant_phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const counts = useMemo(() => ({
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    urgent: tickets.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  }), [tickets]);

  const openDetail = (t: Ticket) => {
    setSelected(t);
    setResponse(t.admin_response || "");
    setNewStatus(t.status);
  };

  const saveResponse = async () => {
    if (!selected) return;
    setSaving(true);
    const patch: any = { status: newStatus };
    if (response.trim()) {
      patch.admin_response = response.trim();
      patch.responded_by = user?.id;
      patch.responded_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("support_tickets" as any)
      .update(patch)
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("تعذّر حفظ التحديث");
      return;
    }
    toast.success("تم تحديث التذكرة");
    setSelected(null);
    fetchTickets();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "مفتوحة", value: counts.open, icon: AlertOctagon, accent: "text-warning bg-warning/10" },
          { label: "قيد المعالجة", value: counts.in_progress, icon: Clock, accent: "text-info bg-info/10" },
          { label: "عاجلة", value: counts.urgent, icon: LifeBuoy, accent: "text-destructive bg-destructive/10" },
          { label: "محلولة", value: counts.resolved, icon: CheckCircle2, accent: "text-success bg-success/10" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <span className={`p-2 rounded-lg ${k.accent}`}><k.icon className="h-4 w-4" /></span>
              <div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-lg font-bold">{k.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن موضوع، رسالة، اسم متجر، أو رقم"
              className="pr-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_AR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              {Object.entries(PRIORITY_AR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">لا توجد تذاكر دعم</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموضوع</TableHead>
                  <TableHead className="text-right">المتجر</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-right">الأولوية</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="max-w-[260px]">
                      <div className="font-semibold truncate">{t.subject}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.message}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{t.merchant_name}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{t.merchant_phone}</div>
                    </TableCell>
                    <TableCell className="text-xs">{CATEGORY_AR[t.category] || t.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={priorityBadge(t.priority)}>{PRIORITY_AR[t.priority] || t.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge(t.status)}>{STATUS_AR[t.status] || t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("ar-SY")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetail(t)}>عرض</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>تفاصيل التذكرة</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">الموضوع</div>
                <div className="font-semibold">{selected.subject}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">الرسالة</div>
                <div className="text-sm whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3">{selected.message}</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">المتجر</div><div className="font-medium truncate">{selected.merchant_name}</div></div>
                <div><div className="text-xs text-muted-foreground">الفئة</div><div>{CATEGORY_AR[selected.category] || selected.category}</div></div>
                <div><div className="text-xs text-muted-foreground">الأولوية</div><div>{PRIORITY_AR[selected.priority] || selected.priority}</div></div>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_AR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>رد الإدارة</Label>
                <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="اكتب الرد للتاجر..." />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>إلغاء</Button>
            <Button onClick={saveResponse} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}