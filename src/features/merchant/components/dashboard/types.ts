export interface DashboardOrder {
  id: string;
  status: string;
  total_amount: number | null;
  final_sale_price: number | null;
  delivery_fee: number | null;
  receiver_name: string | null;
  city: string | null;
  created_at: string;
}

export interface DashboardData {
  loading: boolean;
  availableBalance: number;
  pendingBalance: number;
  newOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  totalOrders30d: number;
  revenue30d: number;
  revenuePrev30d: number;
  deliveryRate: number;
  avgOrderValue: number;
  recentOrders: DashboardOrder[];
  revenueSeries: { date: string; label: string; revenue: number; orders: number }[];
  verificationStatus: string | null;
}

export const PENDING_STATUSES = new Set([
  "processing",
  "shipped",
  "out_for_delivery",
]);

export const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  processing: "قيد المعالجة",
  shipped: "تم الشحن",
  out_for_delivery: "خارج للتوصيل",
  delivered: "تم التوصيل",
  returned: "مرتجع",
  cancelled: "ملغي",
};

export const fmtSYP = (n: number) =>
  new Intl.NumberFormat("ar-SY").format(Math.round(n)) + " ل.س";

export const fmtNum = (n: number) => new Intl.NumberFormat("ar-SY").format(n);