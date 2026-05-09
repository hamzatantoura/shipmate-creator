import { Link } from "react-router-dom";
import {
  Package, Truck, Wallet, ShieldCheck, Bell, type LucideIcon,
} from "lucide-react";
import {
  categorizeNotification, timeAgoAr, type NotificationRow,
} from "../lib/types";

const ICONS: Record<string, LucideIcon> = {
  merchant: Package,
  courier: Truck,
  admin: ShieldCheck,
  system: Bell,
  wallet: Wallet,
};

const ACCENTS: Record<string, string> = {
  merchant: "text-primary bg-primary/10",
  courier: "text-info bg-info/10",
  admin: "text-warning bg-warning/10",
  system: "text-muted-foreground bg-muted",
};

interface Props {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
  onNavigate?: () => void;
  compact?: boolean;
}

export function NotificationItem({ notification: n, onMarkRead, onNavigate, compact }: Props) {
  const cat = categorizeNotification(n);
  const Icon = ICONS[cat] || Bell;
  const accent = ACCENTS[cat] || ACCENTS.system;

  const Inner = (
    <div
      className={`flex items-start gap-3 px-3 ${compact ? "py-2.5" : "py-3"} hover:bg-muted/40 transition-colors cursor-pointer`}
    >
      <span className={`shrink-0 mt-0.5 p-2 rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm leading-snug truncate ${
              n.is_read ? "text-muted-foreground" : "text-foreground font-semibold"
            }`}
          >
            {n.title}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
            {timeAgoAr(n.created_at)}
          </span>
        </div>
        <p
          className={`text-xs leading-relaxed mt-0.5 line-clamp-2 ${
            n.is_read ? "text-muted-foreground/80" : "text-foreground/80"
          }`}
        >
          {n.message}
        </p>
      </div>
      {!n.is_read && (
        <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden />
      )}
    </div>
  );

  const handleClick = () => {
    if (!n.is_read) onMarkRead(n.id);
    onNavigate?.();
  };

  if (n.link) {
    return (
      <Link to={n.link} onClick={handleClick} className="block">
        {Inner}
      </Link>
    );
  }
  return (
    <button type="button" className="block w-full text-right" onClick={handleClick}>
      {Inner}
    </button>
  );
}