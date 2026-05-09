import { Clock, CheckCircle2 } from "lucide-react";
import { computeEta } from "../lib/tracking-utils";

interface Props { status: string; lastUpdate: string | null }

export function EtaBanner({ status, lastUpdate }: Props) {
  const eta = computeEta(status, lastUpdate);
  if (!eta) return null;
  const Icon = eta.done ? CheckCircle2 : Clock;
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${
      eta.done ? "bg-primary/10 border-primary/30" : "bg-info/10 border-info/30"
    }`}>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
        eta.done ? "bg-primary text-primary-foreground" : "bg-info text-info-foreground"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{eta.hint}</p>
        <p className="text-sm font-semibold text-foreground tabular-nums">{eta.label}</p>
      </div>
    </div>
  );
}