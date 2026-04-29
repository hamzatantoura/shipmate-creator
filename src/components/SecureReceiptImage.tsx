import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { getSignedReceiptUrl } from "@/lib/storage-helpers";

interface SecureReceiptImageProps {
  /** Raw storage path or legacy public URL stored on the row */
  source: string | null | undefined;
  bucket?: string;
  alt?: string;
  className?: string;
  expiresIn?: number;
}

/**
 * Asynchronously resolves a private storage object to a signed URL and renders it.
 * Shows a loader while signing and a graceful fallback if the URL can't be generated.
 */
export default function SecureReceiptImage({
  source,
  bucket = "uploads",
  alt = "receipt",
  className = "rounded-lg border border-border max-h-48 object-contain",
  expiresIn = 3600,
}: SecureReceiptImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setUrl(null);

    if (!source) {
      setLoading(false);
      setFailed(true);
      return;
    }

    (async () => {
      const signed = await getSignedReceiptUrl(source, bucket, expiresIn);
      if (cancelled) return;
      if (!signed) {
        setFailed(true);
      } else {
        setUrl(signed);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [source, bucket, expiresIn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-border bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (failed || !url) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground gap-1">
        <ImageOff className="h-5 w-5" />
        <span className="text-xs">الإيصال غير متاح</span>
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} />;
}