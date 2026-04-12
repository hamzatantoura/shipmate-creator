/**
 * Sila Pricing Engine
 * 
 * Pricing structure:
 * - carrier_fee: Net price from carrier (only carrier & admin see this)
 * - platform_margin: 10% of carrier_fee (hidden from everyone, internal only)
 * - merchant_shipping_fee: carrier_fee × 1.1 (what merchant sees as "shipping fee")
 * - collection_fee: 1% of COD amount (shown to merchant separately)
 * - Total merchant cost: merchant_shipping_fee + collection_fee
 */

export interface VolumetricInput {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  actual_weight_kg: number;
}

export interface PricingInput {
  carrier_fee: number;       // Base carrier price from shipping_zones
  cod_amount: number;        // Cash on delivery amount
  weight?: VolumetricInput;  // Optional weight calculation
}

export interface PricingBreakdown {
  // Weight
  volumetric_weight: number;
  billable_weight: number;

  // Hidden (internal/admin only)
  carrier_fee: number;       // Net carrier cost
  platform_margin: number;   // 10% of carrier_fee

  // Visible to merchant
  merchant_shipping_fee: number; // carrier_fee + platform_margin
  collection_fee: number;        // 1% of COD
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

/** Full pricing calculation */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const { carrier_fee, cod_amount } = input;

  // Weight
  let volumetric_weight = 0;
  let billable_weight = input.weight?.actual_weight_kg || 0;
  if (input.weight) {
    const w = calcBillableWeight(input.weight);
    volumetric_weight = w.volumetric;
    billable_weight = w.billable;
  }

  // Hidden platform margin: 10% of carrier fee
  const platform_margin = Math.round(carrier_fee * 0.10);

  // What merchant sees as "shipping fee" (includes hidden margin)
  const merchant_shipping_fee = carrier_fee + platform_margin;

  // Collection fee: 1% of COD (visible to merchant)
  const collection_fee = Math.round(cod_amount * 0.01);

  // Total cost to merchant
  const total_merchant_cost = merchant_shipping_fee + collection_fee;

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
