import { useState } from "react";

const STORAGE_KEY = "shipdash_merchant_id";
const DEFAULT_ID = "00000000-0000-0000-0000-000000000000";

function getOrCreateMerchantId(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  localStorage.setItem(STORAGE_KEY, DEFAULT_ID);
  return DEFAULT_ID;
}

export function useMerchantId() {
  const [merchantId] = useState(getOrCreateMerchantId);
  return merchantId;
}

export function getMerchantId(): string {
  return getOrCreateMerchantId();
}
