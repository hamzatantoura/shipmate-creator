export interface CourierShipmentRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
  districts?: { name: string } | null;
}

export interface CourierDashboardData {
  walletBalance: number;
  companyName: string;
  assigned: CourierShipmentRow[];
  history: CourierShipmentRow[];
  kpis: {
    activeCount: number;
    deliveredToday: number;
    deliveredMonth: number;
    returnedMonth: number;
    earningsMonth: number;
    successRate: number;
  };
  earningsSeries: { date: string; earnings: number; deliveries: number }[];
  routes: { district: string; count: number; cod: number; orders: CourierShipmentRow[] }[];
}

export const fmtSYP = (n: number) =>
  new Intl.NumberFormat("ar-SY").format(Math.round(n || 0)) + " ل.س";
export const fmtNum = (n: number) => new Intl.NumberFormat("ar-SY").format(n || 0);
export const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();

export const ACTIVE_STATUSES = [
  "received_by_courier",
  "processing",
  "shipped",
  "out_for_delivery",
];

export const NEXT_STATUS_MAP: Record<string, { value: string; label: string }[]> = {
  new: [{ value: "received_by_courier", label: "استلام الشحنة" }],
  pending: [{ value: "received_by_courier", label: "استلام الشحنة" }],
  received_by_courier: [
    { value: "shipped", label: "بدء النقل" },
    { value: "returned", label: "إرجاع" },
  ],
  processing: [
    { value: "shipped", label: "بدء النقل" },
    { value: "returned", label: "إرجاع" },
  ],
  shipped: [
    { value: "out_for_delivery", label: "خرجت للتوصيل" },
    { value: "returned", label: "إرجاع" },
  ],
  out_for_delivery: [
    { value: "delivered", label: "تم التسليم" },
    { value: "returned", label: "إرجاع" },
  ],
};