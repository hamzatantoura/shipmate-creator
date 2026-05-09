import { fmtDateTime, type TimelineStep } from "../lib/tracking-utils";

interface Props { steps: TimelineStep[] }

export function ShipmentTimeline({ steps }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4">رحلة الشحنة</h3>
      <ol className="relative space-y-5">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isLast = idx === steps.length - 1;
          const tone =
            step.state === "failed"
              ? { ring: "border-destructive bg-destructive text-destructive-foreground", line: "bg-destructive/40", title: "text-destructive font-semibold" }
              : step.state === "complete"
                ? { ring: "border-primary bg-primary text-primary-foreground", line: "bg-primary/50", title: "text-foreground font-semibold" }
                : step.state === "current"
                  ? { ring: "border-primary bg-primary/15 text-primary animate-pulse", line: "bg-border", title: "text-primary font-semibold" }
                  : { ring: "border-border bg-muted text-muted-foreground", line: "bg-border", title: "text-muted-foreground" };
          return (
            <li key={step.key} className="relative flex items-start gap-4">
              {!isLast && (
                <span aria-hidden className={`absolute right-[17px] top-9 bottom-[-20px] w-px ${tone.line}`} />
              )}
              <span className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 ${tone.ring}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0 pt-1">
                <p className={`text-sm ${tone.title}`}>{step.label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(step.reachedAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}