import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, Loader2, Store, Mail, Phone, Shield, Image as ImageIcon, Video, IdCard, MapPin, Building2 } from "lucide-react";

/** Inline Google "G" mark — shown next to merchants who signed up via Google OAuth. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Google" role="img">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.7 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

interface Merchant {
  id: string;
  user_id: string;
  store_name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  email_confirmed: boolean;
  phone_verified: boolean;
  id_image_url: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  verification_video_url: string | null;
  logo_url: string | null;
  warehouse_address: string | null;
  verification_status: string;
  whatsapp_number: string | null;
  created_at: string;
  auth_provider?: string | null;
}

const STATUS_AR: Record<string, string> = {
  pending_verification: "بانتظار التحقق",
  pending_admin_approval: "بانتظار الموافقة",
  verified: "مُعتمد",
  rejected: "مرفوض",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_verification: "outline",
  pending_admin_approval: "secondary",
  verified: "default",
  rejected: "destructive",
};

export default function AdminMerchantApproval() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [acting, setActing] = useState(false);

  const fetchMerchants = async () => {
    setLoading(true);
    const [{ data: m }, { data: profiles }] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, auth_provider"),
    ]);
    const providerByUser = new Map<string, string>();
    (profiles as any[] | null)?.forEach((p) => providerByUser.set(p.user_id, p.auth_provider ?? "email"));
    const enriched = ((m as any[]) || []).map((row) => ({
      ...row,
      auth_provider: providerByUser.get(row.user_id) ?? "email",
    }));
    setMerchants(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchMerchants(); }, []);

  const handleAction = async (merchantId: string, action: "approve" | "reject") => {
    setActing(true);
    const newStatus = action === "approve" ? "verified" : "rejected";
    const { error } = await supabase
      .from("merchants")
      .update({ verification_status: newStatus } as any)
      .eq("id", merchantId);

    if (error) {
      toast.error("فشل تحديث الحالة: " + error.message);
    } else {
      toast.success(action === "approve" ? "تم اعتماد التاجر ✓" : "تم رفض التاجر");
      setSelectedMerchant(null);
      setReviewNote("");
      fetchMerchants();
    }
    setActing(false);
  };

  const pendingCount = merchants.filter(m =>
    m.verification_status === "pending_admin_approval" || m.verification_status === "pending_verification"
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          إدارة التجار
          {pendingCount > 0 && (
            <Badge variant="destructive" className="mr-2">{pendingCount} بانتظار المراجعة</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : merchants.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا يوجد تجار مسجلين</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المتجر</TableHead>
                  <TableHead>المسؤول</TableHead>
                  <TableHead>المدينة</TableHead>
                  <TableHead>التحقق</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {m.store_name || "—"}
                        {m.auth_provider === "google" && (
                          <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
                            <GoogleMark className="h-3 w-3" />
                            Google
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{m.contact_person || "—"}</TableCell>
                    <TableCell>{m.city || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={m.email_confirmed ? "default" : "outline"} className="text-[10px] px-1">
                          <Mail className="h-3 w-3 ml-0.5" />
                          {m.email_confirmed ? "✓" : "✗"}
                        </Badge>
                        <Badge variant={m.phone_verified ? "default" : "outline"} className="text-[10px] px-1">
                          <Phone className="h-3 w-3 ml-0.5" />
                          {m.phone_verified ? "✓" : "✗"}
                        </Badge>
                        <Badge variant={m.id_image_url ? "default" : "outline"} className="text-[10px] px-1">
                          <ImageIcon className="h-3 w-3 ml-0.5" />
                          {m.id_image_url ? "✓" : "✗"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[m.verification_status] || "outline"}>
                        {STATUS_AR[m.verification_status] || m.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedMerchant(m)} className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> مراجعة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={!!selectedMerchant} onOpenChange={() => setSelectedMerchant(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                مراجعة التاجر: {selectedMerchant?.store_name}
              </DialogTitle>
            </DialogHeader>
            {selectedMerchant && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">المسؤول:</span> {selectedMerchant.contact_person || "—"}</div>
                  <div><span className="text-muted-foreground">الهاتف:</span> <span dir="ltr">{selectedMerchant.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">المدينة:</span> {selectedMerchant.city || "—"}</div>
                  <div><span className="text-muted-foreground">واتساب:</span> <span dir="ltr">{selectedMerchant.whatsapp_number || "—"}</span></div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">حالة التحقق:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={selectedMerchant.email_confirmed ? "default" : "destructive"} className="gap-1">
                      <Mail className="h-3 w-3" />
                      البريد: {selectedMerchant.email_confirmed ? "مؤكد" : "غير مؤكد"}
                    </Badge>
                    <Badge variant={selectedMerchant.phone_verified ? "default" : "destructive"} className="gap-1">
                      <Phone className="h-3 w-3" />
                      الهاتف: {selectedMerchant.phone_verified ? "مؤكد" : "غير مؤكد"}
                    </Badge>
                    <Badge variant={selectedMerchant.id_image_url ? "default" : "destructive"} className="gap-1">
                      <ImageIcon className="h-3 w-3" />
                      الهوية: {selectedMerchant.id_image_url ? "مرفوعة" : "غير مرفوعة"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <IdCard className="h-4 w-4 text-primary" /> توثيق الهوية (KYC)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { url: selectedMerchant.id_front_url, label: "هوية أمامي" },
                      { url: selectedMerchant.id_back_url, label: "هوية خلفي" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <img src={item.url} alt={item.label}
                              className="h-32 w-full rounded border border-border object-cover hover:opacity-80" />
                          </a>
                        ) : (
                          <div className="h-32 rounded border border-dashed border-destructive/40 bg-destructive/5 flex items-center justify-center text-xs text-destructive">
                            غير مرفوع
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Video className="h-3 w-3" /> فيديو التحقق
                    </p>
                    {selectedMerchant.verification_video_url ? (
                      <video
                        src={selectedMerchant.verification_video_url}
                        controls
                        className="w-full max-h-48 rounded border border-border bg-black"
                      />
                    ) : (
                      <div className="h-20 rounded border border-dashed border-destructive/40 bg-destructive/5 flex items-center justify-center text-xs text-destructive">
                        لا يوجد فيديو
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" /> هوية المتجر
                  </p>
                  <div className="flex items-center gap-3">
                    {selectedMerchant.logo_url ? (
                      <img src={selectedMerchant.logo_url} alt="logo"
                        className="h-16 w-16 rounded-lg border border-border object-cover" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 flex items-center justify-center text-[10px] text-destructive text-center">
                        لا شعار
                      </div>
                    )}
                    <div className="text-xs flex-1">
                      <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> عنوان المستودع</p>
                      <p className={selectedMerchant.warehouse_address ? "text-foreground" : "text-destructive"}>
                        {selectedMerchant.warehouse_address || "— غير مُدخل —"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">ملاحظات المراجعة (اختياري):</p>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="أضف ملاحظة..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => handleAction(selectedMerchant.id, "approve")}
                    disabled={acting}
                    className="flex-1 gap-1.5"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    اعتماد التاجر
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction(selectedMerchant.id, "reject")}
                    disabled={acting}
                    className="flex-1 gap-1.5"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    رفض
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
