import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/shared/components/layout/AppHeader";
import SecureReceiptImage from "@/shared/components/inputs/SecureReceiptImage";

interface PayoutRequest {
  id: string;
  merchant_id: string;
  amount: number;
  method: string;
  account_details: string;
  status: string;
  receipt_url: string | null;
  admin_note: string | null;
  created_at: string;
  merchant_name?: string;
  merchant_contact?: string;
  merchant_phone?: string;
}

const METHOD_AR: Record<string, string> = {
  shamcash: "ShamCash",
  syriatel_cash: "سيريتل كاش",
  cash_office: "نقداً من المكتب",
  bank_transfer: "حوالة بنكية",
};

const STATUS_AR: Record<string, string> = {
  pending: "بانتظار المعالجة",
  processing: "قيد المعالجة",
  completed: "مكتملة",
};

const statusColor = (s: string) => {
  switch (s) {
    case "completed": return "bg-primary/20 text-primary border-primary/30";
    case "processing": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchPayouts = async () => {
    const { data } = await supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      // Fetch merchant info for each payout
      const merchantIds = [...new Set(data.map((p: any) => p.merchant_id))];
      const { data: merchants } = await supabase
        .from("merchants")
        .select("user_id, store_name, phone, contact_person")
        .in("user_id", merchantIds);
      const merchantMap = new Map(merchants?.map(m => [m.user_id, m]) || []);
      setPayouts(data.map((p: any) => {
        const m = merchantMap.get(p.merchant_id);
        return { ...p, merchant_name: m?.store_name || "-", merchant_contact: m?.contact_person || "-", merchant_phone: m?.phone || "-" };
      }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchPayouts(); }, []);

  const updatePayoutStatus = async () => {
    if (!selectedPayout || !newStatus) return;
    const { error } = await supabase.rpc("complete_payout", {
      p_payout_id: selectedPayout.id,
      p_new_status: newStatus,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث حالة طلب التسوية");
    setSelectedPayout(null);
    setNewStatus("");
    fetchPayouts();
  };

  const uploadReceipt = async (file: File) => {
    if (!selectedPayout) return;
    setUploading(true);
    // Admin-managed payout receipt — admin RLS policy allows any path inside `uploads`.
    // Keep them under a dedicated `payouts/` prefix for clarity.
    const path = `payouts/${selectedPayout.id}_${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error("فشل رفع الإيصال"); setUploading(false); return; }

    await supabase
      .from("payout_requests")
      .update({ receipt_url: path } as any)
      .eq("id", selectedPayout.id);

    toast.success("تم رفع إيصال التحويل");
    setUploading(false);
    fetchPayouts();
    setSelectedPayout({ ...selectedPayout, receipt_url: path });
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">طلبات التسوية المالية</h1>
        </div>

        {loading ? (
          <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>
        ) : payouts.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لا توجد طلبات تسوية</p>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => (
              <Card
                key={p.id}
                className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => { setSelectedPayout(p); setNewStatus(p.status); }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-display font-bold text-foreground text-lg">
                      {Number(p.amount).toLocaleString()} ل.س
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {p.merchant_name} — {p.merchant_phone}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {METHOD_AR[p.method] || p.method}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("ar")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.receipt_url && <ImageIcon className="h-4 w-4 text-primary" />}
                    <Badge variant="outline" className={statusColor(p.status)}>
                      {STATUS_AR[p.status] || p.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail dialog */}
        <Dialog open={!!selectedPayout} onOpenChange={(o) => !o && setSelectedPayout(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تفاصيل طلب التسوية</DialogTitle>
            </DialogHeader>
            {selectedPayout && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">المبلغ:</span> <span className="font-bold">{Number(selectedPayout.amount).toLocaleString()} ل.س</span></div>
                  <div><span className="text-muted-foreground">الطريقة:</span> <span className="font-bold">{METHOD_AR[selectedPayout.method] || selectedPayout.method}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">اسم المتجر:</span> <span className="font-bold">{selectedPayout.merchant_name}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">اسم البائع:</span> <span className="font-bold">{selectedPayout.merchant_contact}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">الهاتف:</span> <span className="font-bold">{selectedPayout.merchant_phone}</span></div>
                </div>

                {/* Status update */}
                <div className="space-y-2">
                  <Label>تحديث الحالة</Label>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">بانتظار المعالجة</SelectItem>
                        <SelectItem value="processing">قيد المعالجة</SelectItem>
                        <SelectItem value="completed">مكتملة</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={updatePayoutStatus} disabled={newStatus === selectedPayout.status}>
                      حفظ
                    </Button>
                  </div>
                </div>

                {/* Receipt upload */}
                <div className="space-y-2">
                  <Label>إيصال التحويل</Label>
                  {selectedPayout.receipt_url ? (
                    <SecureReceiptImage source={selectedPayout.receipt_url} />
                  ) : (
                    <p className="text-xs text-muted-foreground">لم يتم رفع إيصال بعد</p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadReceipt(e.target.files[0])}
                    />
                    <Button variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
                      <span>
                        <Upload className="h-4 w-4" />
                        {uploading ? "جاري الرفع..." : "رفع إيصال"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
