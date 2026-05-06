import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformSettings {
  id: string;
  // Financial
  default_platform_margin_pct: number;
  default_platform_margin_flat: number;
  default_collection_fee_pct: number;
  return_cost_responsibility: "merchant" | "platform" | "carrier";
  default_return_fee: number;
  // Visibility toggles
  platform_margin_visible: boolean;
  collection_fee_visible: boolean;
  // Shipping defaults
  default_free_shipping_threshold: number;
  // Verification
  verification_mode: "beta" | "production";
  allow_international_phones: boolean;
  // Wallet
  min_payout_amount: number;
  // Public
  platform_whatsapp: string | null;
  public_couriers_visible: boolean;
  product_max_images: number;
  readiness_required_fields: string[];
}

const FALLBACK: PlatformSettings = {
  id: "",
  default_platform_margin_pct: 10,
  default_platform_margin_flat: 0,
  default_collection_fee_pct: 1,
  return_cost_responsibility: "merchant",
  default_return_fee: 0,
  platform_margin_visible: false,
  collection_fee_visible: true,
  default_free_shipping_threshold: 0,
  verification_mode: "beta",
  allow_international_phones: true,
  min_payout_amount: 50000,
  platform_whatsapp: null,
  public_couriers_visible: true,
  product_max_images: 5,
  readiness_required_fields: [
    "store_name","contact_person","phone","whatsapp_number","province_id","warehouse_address",
  ],
};

let cached: PlatformSettings | null = null;
let inflight: Promise<PlatformSettings> | null = null;

function mapRow(row: any): PlatformSettings {
  if (!row) return FALLBACK;
  return {
    id: row.id,
    default_platform_margin_pct: Number(row.default_platform_margin_pct) || 10,
    default_platform_margin_flat: Number(row.default_platform_margin_flat) || 0,
    default_collection_fee_pct: Number(row.default_collection_fee_pct) || 1,
    return_cost_responsibility: row.return_cost_responsibility || "merchant",
    default_return_fee: Number(row.default_return_fee) || 0,
    platform_margin_visible: !!row.platform_margin_visible,
    collection_fee_visible: row.collection_fee_visible !== false,
    default_free_shipping_threshold: Number(row.default_free_shipping_threshold) || 0,
    verification_mode: row.verification_mode === "production" ? "production" : "beta",
    allow_international_phones: row.allow_international_phones !== false,
    min_payout_amount: Number(row.min_payout_amount) || 50000,
    platform_whatsapp: row.platform_whatsapp || null,
    public_couriers_visible: row.public_couriers_visible !== false,
    product_max_images: Number(row.product_max_images) || 5,
    readiness_required_fields: Array.isArray(row.readiness_required_fields)
      ? row.readiness_required_fields
      : FALLBACK.readiness_required_fields,
  };
}

async function fetchSettings(): Promise<PlatformSettings> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("platform_settings" as any)
      .select("*")
      .limit(1)
      .maybeSingle();
    const result = mapRow(data);
    cached = result;
    inflight = null;
    return result;
  })();
  return inflight;
}

export function invalidatePlatformSettings() {
  cached = null;
}

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
    return () => { mounted = false; };
  }, []);

  return { settings, loading };
}
