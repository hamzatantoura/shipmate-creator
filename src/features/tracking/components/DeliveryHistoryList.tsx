import { History } from "lucide-react";
import { STATUS_AR, fmtDateTime, type StatusLog } from "../lib/tracking-utils";

interface Props { history: StatusLog[] }

export function DeliveryHistoryList({ history }: Props) {
  if (!history.length) return null;
  const sorted = [...history].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" /> سجل التحديثات
      </h3>
      <ul className="space-y-2">
        {sorted.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between text-xs bg-muted/30 border border-border rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-foreground font-medium truncate">
                {STATUS_AR[h.new_status] || h.new_status}
              </span>
              {h.old_status && (
                <span className="text-muted-foreground hidden sm:inline">
                  ← {STATUS_AR[h.old_status] || h.old_status}
                </span>
              )}
            </div>
            <span className="text-muted-foreground tabular-nums shrink-0">{fmtDateTime(h.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}