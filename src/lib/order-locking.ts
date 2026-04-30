type LockableOrder = {
  status?: string | null;
  label_printed_at?: string | null;
  shipment_id?: string | null;
};

const CANCEL_LOCKED_STATUSES = new Set([
  "received_by_courier",
  "shipped",
  "delivered",
  "returned",
]);

export const isOrderLocked = (order: LockableOrder) => {
  const isEditLocked = Boolean(order.label_printed_at) || Boolean(order.shipment_id);
  const isCancelLocked = CANCEL_LOCKED_STATUSES.has(order.status ?? "");

  return { isEditLocked, isCancelLocked };
};