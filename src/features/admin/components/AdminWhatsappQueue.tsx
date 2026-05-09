import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  order_id: string | null;
  phone_number: string;
  message: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

const statusBadge = (s: Row["status"]) => {
  switch (s) {
    case "sent":
      return "bg-primary/20 text-primary border-primary/30";
    case "failed":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-warning/20 text-warning border-warning/30";
  }
};
const statusAr: Record<Row["status"], string> = {
  pending: "بالانتظار",
  sent: "تم الإرسال",
  failed: "فشل",
};

export default function AdminWhatsappQueue() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-whatsapp-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    staleTime: 30_000,
  });

  const counts = {
    pending: data?.filter((r) => r.status === "pending").length ?? 0,
    sent: data?.filter((r) => r.status === "sent").length ?? 0,
    failed: data?.filter((r) => r.status === "failed").length ?? 0,
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">طابور رسائل الواتساب</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-warning/20 text-warning border-warning/30">بالانتظار: {counts.pending}</Badge>
          <Badge className="bg-primary/20 text-primary border-primary/30">مُرسلة: {counts.sent}</Badge>
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">فشل: {counts.failed}</Badge>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">جارٍ التحميل...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">لا توجد رسائل في الطابور بعد</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">الرسالة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{row.phone_number}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-foreground truncate" title={row.message}>
                        {row.message}
                      </p>
                      {row.error && (
                        <p className="text-xs text-destructive mt-0.5 truncate" title={row.error}>
                          {row.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge(row.status)}>{statusAr[row.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("ar-SY")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
