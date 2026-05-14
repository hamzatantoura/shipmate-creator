import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Job {
  id: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  status: string;
  errors: any;
  created_at: string;
}

/**
 * Compact history of bulk import jobs.
 * - Used by merchant (filtered to own user) and admin (all).
 */
export default function ImportJobsHistory({ adminMode = false }: { adminMode?: boolean }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Job | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("bulk_import_jobs")
      .select("id,file_name,total_rows,success_count,error_count,status,errors,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!adminMode && user) q = q.eq("merchant_id", user.id);
    const { data } = await q;
    if (data) setJobs(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, adminMode]);

  const statusBadge = (s: string) => {
    if (s === "completed") return <Badge className="bg-success/15 text-success border-success/30">مكتمل</Badge>;
    if (s === "failed") return <Badge variant="destructive">فشل</Badge>;
    return <Badge variant="outline">قيد المعالجة</Badge>;
  };

  if (loading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (jobs.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          لا توجد عمليات استيراد بعد.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الملف</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>نجح</TableHead>
                <TableHead>أخطاء</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(j => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs max-w-[180px] truncate">{j.file_name}</TableCell>
                  <TableCell className="text-xs">{new Date(j.created_at).toLocaleString("ar")}</TableCell>
                  <TableCell>{j.total_rows}</TableCell>
                  <TableCell className="text-success">{j.success_count}</TableCell>
                  <TableCell className="text-destructive">{j.error_count}</TableCell>
                  <TableCell>{statusBadge(j.status)}</TableCell>
                  <TableCell>
                    {Array.isArray(j.errors) && j.errors.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setOpen(j)}>تفاصيل</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>أخطاء الملف: {open?.file_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصف</TableHead>
                  <TableHead>الخطأ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(open?.errors as any[] || []).map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{e.row || "—"}</TableCell>
                    <TableCell className="text-xs">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}