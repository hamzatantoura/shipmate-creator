import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
  className?: string;
}

export default function StarRating({ value, onChange, size = 24, readOnly = false, className }: Props) {
  return (
    <div className={cn("flex items-center gap-1", className)} dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const interactive = !readOnly && onChange;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange!(n)}
            className={cn(
              "transition-transform",
              interactive ? "hover:scale-110 cursor-pointer" : "cursor-default",
            )}
            aria-label={`${n} stars`}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                filled ? "fill-warning text-warning" : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
