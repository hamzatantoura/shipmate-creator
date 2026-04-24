import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformSettings {
  id: string;
  default_platform_margin_pct: number;
  default_collection_fee_pct: number;
  return_cost_responsibility: "merchant" | "platform" | "carrier";
  default_return_fee: number;
}

const FALLBACK: PlatformSettings = {
  id: "",
  default_platform_margin_pct: 10,
  default_collection_fee_pct: 1,
  return_cost_responsibility: "merchant",
  default_return_fee: 0,
};

let cached: PlatformSettings | null = null;
let inflight: Promise<PlatformSettings> | null = null;

async function fetchSettings(): Promise<PlatformSettings> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("platform_settings" as any)
      .select("*")
      .limit(1)
      .maybeSingle();
    const row = (data as any) || null;
    const result: PlatformSettings = row
      ? {
          id: row.id,
          default_platform_margin_pct: Number(row.default_platform_margin_pct) || 10,
          default_collection_fee_pct: Number(row.default_collection_fee_pct) || 1,
          return_cost_responsibility: row.return_cost_responsibility || "merchant",
          default_return_fee: Number(row.default_return_fee) || 0,
        }
      : FALLBACK;
    cached = result;
    inflight = null;
    return result;
  })();
  return inflight;
}

export function invalidatePlatformSettings() {
  cached = null;
}

/**
 * Reactively fetch the single global platform_settings row.
 * Returns FALLBACK while loading so consumers never crash.
 */
export function usePlatformSettings(): { settings: PlatformSettings; loading: boolean } {
  const [settings, setSettings] = useState<PlatformSettings>(cached || FALLBACK);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let mounted = true;
    fetchSettings().then((s) => {
      if (!mounted) return;
      setSettings(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading };
}