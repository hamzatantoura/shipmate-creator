import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Heart, Trash2, ShoppingCart, Package } from "lucide-react";
import { useWishlist } from "./WishlistContext";
import { useCart } from "../cart/CartContext";
import { toast } from "sonner";

export default function WishlistDrawer() {
  const wish = useWishlist();
  const cart = useCart();

  const addToCart = (item: ReturnType<typeof useWishlist>["items"][number]) => {
    cart.add({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      image_url: item.image_url,
      slug: item.slug,
    });
    toast.success("تمت إضافة المنتج إلى السلة!");
  };

  return (
    <Sheet open={wish.isOpen} onOpenChange={(o) => o ? wish.open() : wish.close()}>
      <SheetContent side="left" className="flex flex-col gap-0 p-0 w-full sm:max-w-md" dir="rtl">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-right">
            <Heart className="h-5 w-5 text-destructive fill-destructive" /> المفضّلة ({wish.count})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {wish.items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p>لا توجد منتجات في المفضّلة</p>
              <p className="text-xs mt-2 opacity-70">اضغط على أيقونة القلب في المنتج لإضافته هنا</p>
            </div>
          ) : wish.items.map(item => (
            <div key={item.id} className="flex gap-3 p-3 rounded-lg border border-border bg-card">
              <div className="h-16 w-16 rounded-md bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : <Package className="h-6 w-6 text-muted-foreground/40" />}
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</p>
                <p className="text-primary font-bold text-sm mt-1">{Number(item.price).toLocaleString()} ل.س</p>
                <div className="flex items-center justify-between mt-auto pt-2 gap-2">
                  <Button type="button" size="sm" className="h-8 gap-1.5 text-xs flex-1"
                    onClick={() => addToCart(item)}>
                    <ShoppingCart className="h-3.5 w-3.5" /> أضف للسلة
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => wish.remove(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {wish.items.length > 0 && (
          <div className="border-t border-border p-4 bg-card">
            <Button variant="outline" className="w-full" onClick={wish.clear}>
              تفريغ المفضّلة
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}