import { Search, X, Download, Plus, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_META } from "@/features/shipments/lib/order-status";

const FILTERABLE_STATUSES = [
  "new",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "returned",
  "cancelled",
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  totalCount: number;
  onCreate: () => void;
  onExport: () => void;
  exporting?: boolean;
}

export default function MerchantOrdersToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  totalCount,
  onCreate,
  onExport,
  exporting,
}: Props) {
  const hasFilter = !!search || (status && status !== "all");
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث باسم الزبون أو رقم الهاتف أو كود صِلة..."
            className="pr-10 pl-3 h-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="مسح البحث"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 md:shrink-0">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-10 w-[170px] gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {FILTERABLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_META[s]?.label || s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-1 text-muted-foreground"
              onClick={() => {
                onSearchChange("");
                onStatusChange("all");
              }}
            >
              <X className="h-3.5 w-3.5" /> مسح
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5"
            onClick={onExport}
            disabled={exporting || totalCount === 0}
            title="تصدير الطلبات الحالية إلى CSV"
          >
            <Download className="h-4 w-4" />
            {exporting ? "جاري التصدير..." : "تصدير CSV"}
          </Button>

          <Button className="h-10 gap-1.5" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">طلب جديد</span>
          </Button>
        </div>
      </div>

      {hasFilter && (
        <div className="text-xs text-muted-foreground">
          {totalCount > 0
            ? `تم العثور على ${totalCount.toLocaleString("ar-SY")} طلب يطابق المعايير`
            : "لا توجد طلبات مطابقة"}
        </div>
      )}
    </div>
  );
}