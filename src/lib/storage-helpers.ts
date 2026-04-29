import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage object path from either a raw path or a legacy public URL.
 * Legacy rows in payout_requests / top_up_requests can hold full public URLs like:
 *   https://<ref>.supabase.co/storage/v1/object/public/uploads/receipts/foo.png
 * New rows store just the raw object path (e.g. "merchants/<uid>/receipts/foo.png").
 */
export function extractStoragePath(urlOrPath: string | null | undefined, bucket: string): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  // Already a raw path (no protocol)
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  // Match /storage/v1/object/(public|sign|authenticated)/<bucket>/<path...>
  const re = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/(.+?)(?:\\?|$)`);
  const match = trimmed.match(re);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

/**
 * Create a signed URL (default 1h) from either a raw object path
 * or a legacy public URL. Returns null if the path can't be resolved
 * or signing fails.
 */
export async function getSignedReceiptUrl(
  urlOrPath: string | null | undefined,
  bucket: string = "uploads",
  expiresIn: number = 3600,
): Promise<string | null> {
  const path = extractStoragePath(urlOrPath, bucket);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}