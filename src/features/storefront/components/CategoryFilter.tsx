import { cn } from "@/lib/utils";

interface Props {
  categories: string[];
  active: string | null;
  onChange: (cat: string | null) => void;
}

export default function CategoryFilter({ categories, active, onChange }: Props) {
  if (categories.length === 0) return null;
  return (
    <div className="sticky top-14 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onChange(null)}
          className={cn(
            "shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
            active === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          الكل
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
              active === c
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}