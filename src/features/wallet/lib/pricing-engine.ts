/**
 * Sila Pricing Engine
 *
 * NO HARDCODED PERCENTAGES.
 * The engine accepts dynamic settings sourced from:
 *   - public.platform_settings (default_platform_margin_pct, default_collection_fee_pct)
 *   - public.couriers (cod_fee_type / cod_fee_value) when a courier is assigned
 *
 * Pricing structure:
 * - carrier_fee: Net price from carrier (carrier & admin only)
 * - platform_margin: carrier_fee × platform_margin_pct
 * - merchant_shipping_fee: carrier_fee + platform_margin
 * - collection_fee: comes from courier (fixed/percentage) OR falls back to platform default %
 * - total_merchant_cost = merchant_shipping_fee + collection_fee
 */

export interface VolumetricInput {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  actual_weight_kg: number;
}

export interface PricingSettings {
  /** Platform margin percent applied to carrier_fee. Required. */
  platform_margin_pct: number;
  /** Flat platform margin amount added on top (manual control by admin). */
  platform_margin_flat?: number;
  /** Courier-specific COD fee. If absent, falls back to platform default %. */
  courier_cod_fee_type?: "fixed" | "percentage";
  courier_cod_fee_value?: number;
  /** Fallback collection fee % applied when no courier override is provided. */
  default_collection_fee_pct: number;
  /** Who pays the COD collection fee. Default: merchant. */
  cod_collection_responsibility?: "merchant" | "courier_absorbs";
  /** Courier return fee policy. */
  courier_return_fee_type?: "percentage" | "fixed";
  courier_return_fee_percentage?: number;
  courier_return_fee_fixed?: number;
}

export interface PricingInput {
  carrier_fee: number;       // Base carrier price from shipping_zones
  cod_amount: number;        // Cash on delivery amount
  settings: PricingSettings; // Dynamic financial rules
  weight?: VolumetricInput;  // Optional weight calculation
}

export interface PricingBreakdown {
  // Weight
  volumetric_weight: number;
  billable_weight: number;

  // Hidden (internal/admin only)
  carrier_fee: number;       // Net carrier cost
  platform_margin: number;   // carrier_fee × platform_margin_pct

  // Visible to merchant
  merchant_shipping_fee: number; // carrier_fee + platform_margin
  collection_fee: number;        // From courier, else platform default
  total_merchant_cost: number;   // merchant_shipping_fee + collection_fee

  // Net to merchant
  net_to_merchant: number;   // cod_amount - total_merchant_cost
}

/** Calculate volumetric weight: L×W×H / 5000 */
export function calcVolumetricWeight(l: number, w: number, h: number): number {
  if (l <= 0 || w <= 0 || h <= 0) return 0;
  return (l * w * h) / 5000;
}

/** Get billable weight (max of actual vs volumetric) */
export function calcBillableWeight(input: VolumetricInput): { volumetric: number; billable: number } {
  const volumetric = calcVolumetricWeight(input.length_cm, input.width_cm, input.height_cm);
  const billable = Math.max(input.actual_weight_kg, volumetric);
  return { volumetric, billable };
}

/** Compute the courier collection fee — fixed amount OR % of COD. Falls back to platform default %. */
export function calcCollectionFee(cod_amount: number, settings: PricingSettings): number {
  if (settings.courier_cod_fee_type && typeof settings.courier_cod_fee_value === "number") {
    if (settings.courier_cod_fee_type === "fixed") {
      return Math.max(0, Math.round(settings.courier_cod_fee_value));
    }
    return Math.max(0, Math.round((cod_amount * settings.courier_cod_fee_value) / 100));
  }
  return Math.max(0, Math.round((cod_amount * (settings.default_collection_fee_pct || 0)) / 100));
}

/**
 * Compute the return fee charged when a shipment is returned.
 * percentage: % of the courier shipping fee. fixed: flat amount.
 */
export function calcReturnFee(carrier_fee: number, settings: PricingSettings): number {
  const type = settings.courier_return_fee_type || "percentage";
  if (type === "fixed") {
    return Math.max(0, Math.round(settings.courier_return_fee_fixed || 0));
  }
  const pct = Math.max(0, Math.min(100, settings.courier_return_fee_percentage || 0));
  return Math.max(0, Math.round((carrier_fee * pct) / 100));
}

/** Full pricing calculation */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const { carrier_fee, cod_amount, settings } = input;

  // Weight
  let volumetric_weight = 0;
  let billable_weight = input.weight?.actual_weight_kg || 0;
  if (input.weight) {
    const w = calcBillableWeight(input.weight);
    volumetric_weight = w.volumetric;
    billable_weight = w.billable;
  }

  // Dynamic platform margin (from platform_settings)
  const marginPct = Number(settings.platform_margin_pct) || 0;
  const marginFlat = Number(settings.platform_margin_flat) || 0;
  const platform_margin = Math.round((carrier_fee * marginPct) / 100) + Math.max(0, marginFlat);

  // What merchant sees as "shipping fee" (includes hidden margin)
  const merchant_shipping_fee = carrier_fee + platform_margin;

  // Dynamic collection fee — courier override OR platform default
  const collection_fee = calcCollectionFee(cod_amount, settings);

  // Total cost to merchant — exclude collection_fee if the courier absorbs it
  const merchant_collection_fee =
    settings.cod_collection_responsibility === "courier_absorbs" ? 0 : collection_fee;
  const total_merchant_cost = merchant_shipping_fee + merchant_collection_fee;

  // Net amount merchant receives
  const net_to_merchant = cod_amount - total_merchant_cost;

  return {
    volumetric_weight: Math.round(volumetric_weight * 100) / 100,
    billable_weight: Math.round(billable_weight * 100) / 100,
    carrier_fee,
    platform_margin,
    merchant_shipping_fee,
    collection_fee,
    total_merchant_cost,
    net_to_merchant,
  };
}

/** Check if order would be a loss (shipping + fees > product price) */
export function isLossOrder(pricing: PricingBreakdown, productPrice: number): boolean {
  return pricing.total_merchant_cost >= productPrice;
}
