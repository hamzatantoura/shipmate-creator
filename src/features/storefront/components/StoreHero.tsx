import { Store, Share2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StoreInfoDialog from "./StoreInfoDialog";
import { toast } from "sonner";

interface Props {
  merchantId: string;
  storeName: string;
  bio: string | null;
  city: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  operatingHours: string | null;
  whatsappNumber: string | null;
  socialLinks?: Record<string, string> | null;
  websiteUrl?: string | null;
}

export default function StoreHero(props: Props) {
  const handleShare = async () => {
    const url = window.location.href;
    const shareData = { title: props.storeName, text: `تسوّق من ${props.storeName} على صلة`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط المتجر");
    } catch {
      toast.error("تعذّر نسخ الرابط");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("تم نسخ رابط المتجر");
    } catch {
      toast.error("تعذّر نسخ الرابط");
    }
  };

  return (
    <header className="relative">
      {/* Banner */}
      <div className="relative h-40 sm:h-56 md:h-72 w-full overflow-hidden bg-gradient-to-br from-primary/30 via-primary/10 to-background">
        {props.bannerUrl ? (
          <img src={props.bannerUrl} alt={`غلاف ${props.storeName}`} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.25),transparent_60%)]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Info row */}
      <div className="max-w-5xl mx-auto px-4 -mt-12 sm:-mt-14 relative">
        <div className="flex items-end gap-4">
          {/* Logo */}
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-card border-4 border-background shadow-xl overflow-hidden flex items-center justify-center shrink-0">
            {props.logoUrl ? (
              <img src={props.logoUrl} alt={props.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="h-10 w-10 text-primary" />
            )}
          </div>
          <div className="flex-1 pb-1 min-w-0">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground truncate">{props.storeName}</h1>
            {props.city && <p className="text-xs text-muted-foreground">{props.city}</p>}
          </div>
        </div>

        {/* Bio & actions */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pb-4">
          {props.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">{props.bio}</p>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <StoreInfoDialog
              merchantId={props.merchantId}
              storeName={props.storeName}
              operatingHours={props.operatingHours}
              whatsappNumber={props.whatsappNumber}
              socialLinks={props.socialLinks}
              websiteUrl={props.websiteUrl}
            />
            <Button size="sm" variant="default" className="gap-1.5 rounded-full" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" /> مشاركة
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}