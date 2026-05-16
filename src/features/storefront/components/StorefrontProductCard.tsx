import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Check, Heart, Share2 } from "lucide-react";
import { useCart } from "../cart/CartContext";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Product {
  id: string; name: string; image_url: string | null;
  price: number; original_price: number | null; slug: string | null;
  in_stock: boolean;
}

export default function StorefrontProductCard({ product, eager }: { product: Product; eager?: boolean }) {
  const p = product;
  const cart = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const wishKey = "sila_wishlist";
  const [fav, setFav] = useState(false);
  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(wishKey) || "[]");
      setFav(list.includes(p.id));
    } catch { /* ignore */ }
  }, [p.id]);

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const list: string[] = JSON.parse(localStorage.getItem(wishKey) || "[]");
      const next = list.includes(p.id) ? list.filter(x => x !== p.id) : [...list, p.id];
      localStorage.setItem(wishKey, JSON.stringify(next));
      setFav(!fav);
      toast.success(!fav ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة");
    } catch { /* ignore */ }
  };

  const share = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/product/${p.slug || p.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("تم نسخ رابط المنتج");
      }
    } catch { /* user cancelled */ }
  };

  const hasDiscount = p.original_price && p.original_price > p.price;
  const discountPct = hasDiscount
    ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100)
    : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cart.add({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      image_url: p.image_url,
      slug: p.slug,
    });
    setJustAdded(true);
    toast.success("تمت إضافة المنتج إلى السلة!", { duration: 1800 });
    setTimeout(() => setJustAdded(false), 1200);
  };

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

          <div className="absolute top-2 end-2 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={toggleFav}
              aria-label="إضافة للمفضلة"
              className="h-8 w-8 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
            >
              <Heart className={`h-4 w-4 transition-colors ${fav ? "fill-destructive text-destructive" : "text-foreground"}`} />
            </button>
            <button
              type="button"
              onClick={share}
              aria-label="مشاركة المنتج"
              className="h-8 w-8 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
            >
              <Share2 className="h-4 w-4 text-foreground" />
            </button>
          </div>

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
          <Button
            type="button"
            size="sm"
            disabled={!p.in_stock}
            onClick={handleAdd}
            className="w-full h-9 mt-1 gap-1.5 text-xs"
            variant={justAdded ? "secondary" : "default"}
          >
            {justAdded ? <><Check className="h-3.5 w-3.5" /> أُضيف</> : <><ShoppingCart className="h-3.5 w-3.5" /> إضافة للسلة</>}
          </Button>
        </div>
      </Card>
    </Link>
  );
}