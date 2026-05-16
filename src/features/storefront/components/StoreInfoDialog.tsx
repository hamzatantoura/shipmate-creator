import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, MapPin, Phone, MessageCircle, Clock, Star, Facebook, Instagram, Globe, Send } from "lucide-react";

interface Branch {
  id: string; name: string; address: string;
  phone: string | null; whatsapp: string | null; is_primary: boolean;
}

interface Props {
  merchantId: string;
  storeName: string;
  operatingHours: string | null;
  whatsappNumber: string | null;
  socialLinks?: Record<string, string> | null;
  websiteUrl?: string | null;
}

export default function StoreInfoDialog({ merchantId, storeName, operatingHours, whatsappNumber, socialLinks, websiteUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("merchant_branches_public" as any).select("*").eq("merchant_id", merchantId)
      .order("is_primary", { ascending: false })
      .then(({ data }) => { if (data) setBranches(data as any); });
  }, [open, merchantId]);

  const waLink = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Info className="h-3.5 w-3.5" /> معلومات المتجر
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{storeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {operatingHours && (
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-foreground">ساعات العمل</div>
                <div className="text-muted-foreground whitespace-pre-line">{operatingHours}</div>
              </div>
            </div>
          )}

          {whatsappNumber && (
            <a href={waLink(whatsappNumber)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline">
              <MessageCircle className="h-4 w-4" />
              <span>تواصل عبر واتساب</span>
            </a>
          )}

          {(socialLinks && Object.keys(socialLinks).length > 0) || websiteUrl ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {socialLinks?.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs rounded-full border border-border px-3 py-1 hover:bg-accent">
                  <Facebook className="h-3.5 w-3.5" /> فيسبوك
                </a>
              )}
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs rounded-full border border-border px-3 py-1 hover:bg-accent">
                  <Instagram className="h-3.5 w-3.5" /> إنستغرام
                </a>
              )}
              {socialLinks?.tiktok && (
                <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs rounded-full border border-border px-3 py-1 hover:bg-accent">
                  تيك توك
                </a>
              )}
              {socialLinks?.telegram && (
                <a href={socialLinks.telegram} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs rounded-full border border-border px-3 py-1 hover:bg-accent">
                  <Send className="h-3.5 w-3.5" /> تيليغرام
                </a>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs rounded-full border border-border px-3 py-1 hover:bg-accent">
                  <Globe className="h-3.5 w-3.5" /> الموقع
                </a>
              )}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> الفروع
            </div>
            {branches.length === 0 ? (
              <p className="text-muted-foreground text-xs">لا توجد فروع مسجّلة بعد.</p>
            ) : (
              <ul className="space-y-3">
                {branches.map((b) => (
                  <li key={b.id} className="rounded-lg border border-border bg-card/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{b.name}</span>
                      {b.is_primary && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                          <Star className="h-3 w-3 fill-primary" /> الرئيسي
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">{b.address}</div>
                    <div className="flex gap-3 pt-1">
                      {b.phone && (
                        <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Phone className="h-3 w-3" /> {b.phone}
                        </a>
                      )}
                      {b.whatsapp && (
                        <a href={waLink(b.whatsapp)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <MessageCircle className="h-3 w-3" /> واتساب
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}