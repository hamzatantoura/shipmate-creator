import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "vendor" | "merchant";

interface UserRow {
  user_id: string;
  email?: string;
  store_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  roles: AppRole[];
  primary_role: AppRole;
}

const ROLE_AR: Record<AppRole, string> = {
  admin: "مدير",
  vendor: "شركة شحن",
  merchant: "تاجر",
};
const roleBadge = (r: AppRole) => {
  switch (r) {
    case "admin": return "bg-destructive/15 text-destructive border-destructive/30";
    case "vendor": return "bg-info/15 text-info border-info/30";
    default: return "bg-primary/10 text-primary border-primary/30";
  }
};

export default function AdminRoleManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [confirm, setConfirm] = useState<{ user: UserRow; nextRole: AppRole } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("user_id, store_name, contact_person, phone, role"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr || rErr) {
      toast.error("تعذّر تحميل المستخدمين");
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, AppRole[]>();
    for (const r of roles || []) {
      const list = roleMap.get(r.user_id as string) || [];
      list.push(r.role as AppRole);
      roleMap.set(r.user_id as string, list);
    }
    const rows: UserRow[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      store_name: p.store_name,
      contact_person: p.contact_person,
      phone: p.phone,
      roles: roleMap.get(p.user_id) || [p.role as AppRole],
      primary_role: (p.role as AppRole) || "merchant",
    }));
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== "all" && u.primary_role !== filter) return false;
      if (q) {
        const hay = `${u.store_name || ""} ${u.contact_person || ""} ${u.phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, filter]);

  const counts = useMemo(() => ({
    admin: users.filter((u) => u.primary_role === "admin").length,
    vendor: users.filter((u) => u.primary_role === "vendor").length,
    merchant: users.filter((u) => u.primary_role === "merchant").length,
  }), [users]);

  const changeRole = async () => {
    if (!confirm) return;
    setSaving(true);
    const { user, nextRole } = confirm;
    // Update profiles.role + sync user_roles table (single role per user)
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("profiles").update({ role: nextRole as any }).eq("user_id", user.user_id),
      supabase.from("user_roles").delete().eq("user_id", user.user_id),
    ]);
    if (e1 || e2) {
      toast.error(e1?.message || e2?.message || "تعذّر التحديث");
      setSaving(false);
      return;
    }
    const { error: e3 } = await supabase
      .from("user_roles")
      .insert({ user_id: user.user_id, role: nextRole as any });
    setSaving(false);
    if (e3) {
      toast.error(e3.message);
      return;
    }
    toast.success(`تم تحديث الدور إلى: ${ROLE_AR[nextRole]}`);
    setConfirm(null);
    fetchUsers();
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-3 gap-3">
        {(["admin", "vendor", "merchant"] as AppRole[]).map((r) => (
          <Card key={r}>
            <CardContent className="p-4 flex items-center gap-3">
              <span className={`p-2 rounded-lg ${roleBadge(r)}`}><ShieldCheck className="h-4 w-4" /></span>
              <div>
                <div className="text-xs text-muted-foreground">{ROLE_AR[r]}</div>
                <div className="text-lg font-bold">{counts[r]}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم الهاتف"
              className="pr-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأدوار</SelectItem>
              <SelectItem value="admin">مدير</SelectItem>
              <SelectItem value="vendor">شركة شحن</SelectItem>
              <SelectItem value="merchant">تاجر</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">الدور الحالي</TableHead>
                  <TableHead className="text-right">تغيير الدور</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold">{u.store_name || u.contact_person || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell className="text-sm" dir="ltr">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleBadge(u.primary_role)}>{ROLE_AR[u.primary_role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.primary_role}
                        onValueChange={(v) => v !== u.primary_role && setConfirm({ user: u, nextRole: v as AppRole })}
                      >
                        <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="merchant">تاجر</SelectItem>
                          <SelectItem value="vendor">شركة شحن</SelectItem>
                          <SelectItem value="admin">مدير</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الدور</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تغيير دور {confirm?.user.store_name || "المستخدم"} إلى{" "}
              <span className="font-bold">{confirm ? ROLE_AR[confirm.nextRole] : ""}</span>؟ سيتأثر وصول المستخدم لجميع الصفحات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={changeRole} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}