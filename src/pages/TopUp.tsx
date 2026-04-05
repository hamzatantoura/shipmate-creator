import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Loader2, Smartphone, Upload, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useMerchantId } from "@/hooks/use-merchant-id";

const METHODS = [
  { value: "shamcash", label: "ShamCash", icon: CreditCard, desc: "الدفع عبر تطبيق شام كاش" },
  { value: "syriatel_cash", label: "سيرياتيل كاش", icon: Smartphone, desc: "التحويل عبر سيرياتيل كاش" },
  { value: "manual_transfer", label: "حوالة يدوية", icon: Upload, desc: "تحويل بنكي مع رفع صورة الإيصال" },
];

export default function TopUp() {
  const merchantId = useMerchantId();
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) { toast.error("اختر طريقة الدفع"); return; }
    if (!receiptFile) { toast.error("يرجى رفع صورة وصل التحويل"); return; }
    setLoading(true);

    const ext = receiptFile.name.split(".").pop();
    const path = `receipts/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("uploads").upload(path, receiptFile);
    if (upErr) { toast.error("فشل رفع الإيصال"); setLoading(false); return; }
    const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);

    const { error } = await supabase.from("top_up_requests").insert({
      merchant_id: merchantId,
      amount: parseFloat(amount) || 0,
      method,
      receipt_url: pub.publicUrl,
      reference_number: referenceNumber.trim() || null,
    } as any);

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال طلب شحن الرصيد! سيتم مراجعته قريباً.");
    setMethod(""); setAmount(""); setReferenceNumber(""); setReceiptFile(null);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/wallet">
            <Button variant="ghost" size="icon"><ArrowRight className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-display font-bold text-foreground">شحن الرصيد</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>المبلغ (ل.س)</Label>
            <Input type="number" min="1" placeholder="أدخل المبلغ" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>

          <div className="space-y-3">
            <Label>طريقة الدفع</Label>
            {METHODS.map(m => (
              <Card
                key={m.value}
                className={`cursor-pointer transition-all ${method === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                onClick={() => setMethod(m.value)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${method === m.value ? 'bg-primary/20' : 'bg-muted'}`}>
                    <m.icon className={`h-5 w-5 ${method === m.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <Label>رقم المرجع / رقم العملية</Label>
            <Input placeholder="أدخل رقم العملية أو المرجع" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>صورة وصل التحويل <span className="text-destructive">*</span></Label>
            <Input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} required />
            {receiptFile && <p className="text-xs text-muted-foreground">✓ {receiptFile.name}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            إرسال طلب شحن الرصيد
          </Button>
        </form>
      </main>
    </div>
  );
}
