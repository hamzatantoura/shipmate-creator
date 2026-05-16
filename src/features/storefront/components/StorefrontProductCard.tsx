import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Package } from "lucide-react";

interface Product {
  id: string; name: string; image_url: string | null;
  price: number; original_price: number | null; slug: string | null;
  in_stock: boolean;
}

export default function StorefrontProductCard({ product, eager }: { product: Product; eager?: boolean }) {
  const p = product;
  const hasDiscount = p.original_price && p.original_price > p.price;
  const discountPct = hasDiscount
    ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100)
    : 0;

  return (
    <Link to={`/product/${p.slug || p.id}`} className="block group animate-fade-in">
      <Card className="border-border hover:border-primary/40 transition-all overflow-hidden h-full hover:shadow-lg hover:-translate-y-0.5 duration-300">
        <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground/30" />
          )}

          {hasDiscount && (
            <span className="absolute top-2 start-2 bg-destructive text-destructive-foreground text-[11px] font-bold px-2 py-0.5 rounded-md shadow">
              %{discountPct}-
            </span>
          )}

          {!p.in_stock && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-xs font-bold text-foreground bg-card px-3 py-1 rounded-full border border-border">
                غير متوفر
              </span>
            </div>
          )}
        </div>

        <div className="p-3 space-y-1.5">
          <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
            {p.name}
          </h3>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-primary font-display font-bold text-base">
              {Number(p.price).toLocaleString()} ل.س
            </span>
            {hasDiscount && (
              <span className="text-muted-foreground text-xs line-through">
                {Number(p.original_price).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}