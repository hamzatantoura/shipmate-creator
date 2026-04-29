import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText, Loader2 } from "lucide-react";

interface AuditRow {
  id: string;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const TABLE_AR: Record<string, string> = {
  orders: "الطلبات",
  wallets: "المحافظ",
  merchants: "التجار",
  couriers: "شركات الشحن",
};

const ACTION_AR: Record<string, string> = {
  INSERT: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
};

const FIELD_AR: Record<string, string> = {
  status: "الحالة",
  balance: "الرصيد",
  wallet_balance: "رصيد المحفظة",
  is_active: "حالة التفعيل",
  verification_status: "حالة التحقق",
  total_amount: "المبلغ الإجمالي",
  net_amount: "صافي المبلغ",
  delivery_fee: "رسوم التوصيل",
  platform_fee: "رسوم المنصة",
  return_reason: "سبب الإرجاع",
  courier_id: "شركة الشحن",
  assigned_branch_id: "الفرع المُعيَّن",
  phone: "الهاتف",
  store_name: "اسم المتجر",
  name: "الاسم",
};

const STATUS_AR: Record<string, string> = {
  new: "جديد",
  pending: "بانتظار",
  pending_pickup: "بانتظار الاستلام",
  at_warehouse: "في المستودع",
  in_transit_intercity: "قيد الشحن",
  with_distributor: "مع المندوب",
  delivered: "تم التسليم",
  returned: "مرتجع",
  cancelled: "ملغي",
  rejected: "مرفوض",
};

const formatValue = (key: string, val: unknown): string => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "نعم" : "لا";
  if (key === "status" && typeof val === "string") return STATUS_AR[val] || val;
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "object") return JSON.stringify(val).slice(0, 60);
  return String(val).slice(0, 80);
};

/** Build a human-readable diff between old/new JSON snapshots */
const describeChange = (row: AuditRow): string[] => {
  if (row.action === "INSERT") return ["تم إنشاء سجل جديد"];
  if (row.action === "DELETE") return ["تم حذف السجل"];
  if (!row.old_data || !row.new_data) return ["—"];

  const ignored = new Set(["updated_at", "created_at", "id"]);
  const changes: string[] = [];
  const keys = new Set([...Object.keys(row.old_data), ...Object.keys(row.new_data)]);

  keys.forEach((key) => {
    if (ignored.has(key)) return;
    const oldV = (row.old_data as Record<string, unknown>)[key];
    const newV = (row.new_data as Record<string, unknown>)[key];
    if (JSON.stringify(oldV) === JSON.stringify(newV)) return;
    const label = FIELD_AR[key] || key;
    changes.push(`${label}: ${formatValue(key, oldV)} ← ${formatValue(key, newV)}`);
  });

  if (changes.length === 0) return ["لا تغييرات هامة"];
  return changes.slice(0, 4);
};

const actionColor = (a: string) => {
  switch (a) {
    case "INSERT": return "bg-primary/20 text-primary border-primary/30";
    case "UPDATE": return "bg-warning/20 text-warning border-warning/30";
    case "DELETE": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function AdminAuditLog() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["system-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_audit_logs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
    refetchInterval: 30000,
  });

  // Resolve actor display names in a second query (best-effort, falls back to short uuid)
  const actorIds = Array.from(new Set((rows ?? []).map(r => r.actor_id).filter(Boolean))) as string[];
  const { data: actors } = useQuery({
    queryKey: ["audit-actors", actorIds],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, store_name, contact_person, role")
        .in("user_id", actorIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        const u = p as { user_id: string; store_name: string | null; contact_person: string | null; role: string };
        map[u.user_id] = u.contact_person || u.store_name || u.role;
      });
      return map;
    },
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-primary" />
          سجل الحركات النظامية (Audit Log)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-sm">لا توجد حركات مسجلة بعد</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الوقت</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الجدول</TableHead>
                  <TableHead className="text-right">العملية</TableHead>
                  <TableHead className="text-right">وصف التغيير</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const actor = r.actor_id ? (actors?.[r.actor_id] || `${r.actor_id.slice(0, 8)}…`) : "النظام";
                  const changes = describeChange(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("ar", {
                          year: "numeric", month: "2-digit", day: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">{actor}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="bg-muted text-foreground border-border">
                          {TABLE_AR[r.table_name] || r.table_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={actionColor(r.action)}>
                          {ACTION_AR[r.action] || r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <ul className="space-y-0.5">
                          {changes.map((c, i) => (
                            <li key={i} className="text-foreground">{c}</li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}