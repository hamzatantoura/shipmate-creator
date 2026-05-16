import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtSYP, type CourierDashboardData } from "./types";

interface Props { data: CourierDashboardData["earningsSeries"]; }

export function EarningsChart({ data }: Props) {
  const recent = data.slice(-7).reverse();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">الأرباح آخر 7 أيام</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs text-muted-foreground">
                <th className="text-right px-3 py-2 font-medium">اليوم</th>
                <th className="text-right px-3 py-2 font-medium">الأرباح</th>
                <th className="text-right px-3 py-2 font-medium">التوصيلات</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.date} className="border-t border-border/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{d.date}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{fmtSYP(d.earnings)}</td>
                  <td className="px-3 py-2 tabular-nums">{d.deliveries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}