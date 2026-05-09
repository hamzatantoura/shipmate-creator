import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Loader2, Smartphone, Upload, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import AppHeader from "@/shared/components/layout/AppHeader";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useLanguage } from "@/i18n/use-language";

export default function TopUp() {
  const { user } = useAuth();
  const { t } = useTranslation("merchant");
  const { meta, isRtl } = useLanguage();
  const Back = isRtl ? ArrowRight : ArrowLeft;
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const METHODS = [
    { value: "shamcash", label: t("topup.methods.shamcash.label"), icon: CreditCard, desc: t("topup.methods.shamcash.desc") },
    { value: "syriatel_cash", label: t("topup.methods.syriatel.label"), icon: Smartphone, desc: t("topup.methods.syriatel.desc") },
    { value: "manual_transfer", label: t("topup.methods.manual.label"), icon: Upload, desc: t("topup.methods.manual.desc") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) { toast.error(t("topup.errors.selectMethod")); return; }
    if (!receiptFile) { toast.error(t("topup.errors.uploadReceipt")); return; }
    if (!user?.id) { toast.error(t("topup.errors.mustLogin")); return; }
    setLoading(true);

    const ext = receiptFile.name.split(".").pop();
    const path = `merchants/${user.id}/receipts/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("uploads").upload(path, receiptFile);
    if (upErr) { toast.error(t("topup.errors.uploadFailed")); setLoading(false); return; }

    const { error } = await supabase.from("top_up_requests").insert({
      merchant_id: user.id,
      amount: parseFloat(amount) || 0,
      method,
      receipt_url: path,
      reference_number: referenceNumber.trim() || null,
    } as any);

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("topup.success"));
    setMethod(""); setAmount(""); setReferenceNumber(""); setReceiptFile(null);
  };

  return (
    <div className="min-h-screen bg-background" dir={meta.dir}>
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/merchant/wallet">
            <Button variant="ghost" size="icon"><Back className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-display font-bold text-foreground">{t("topup.title")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>{t("topup.amountLabel")}</Label>
            <Input type="number" min="1" placeholder={t("topup.amountPlaceholder")} value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>

          <div className="space-y-3">
            <Label>{t("topup.methodLabel")}</Label>
            {METHODS.map(m => (
              <Card key={m.value}
                className={`cursor-pointer transition-all ${method === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                onClick={() => setMethod(m.value)}>
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
            <Label>{t("topup.referenceLabel")}</Label>
            <Input placeholder={t("topup.referencePlaceholder")} value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("topup.receiptLabel")} <span className="text-destructive">*</span></Label>
            <Input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} required />
            {receiptFile && <p className="text-xs text-muted-foreground">✓ {receiptFile.name}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
            {t("topup.submit")}
          </Button>
        </form>
      </main>
    </div>
  );
}
