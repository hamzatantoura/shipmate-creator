import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Package, ShieldAlert } from "lucide-react";

interface Product {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; slug: string | null; size_category: string;
}

interface MerchantProfile {
  store_name: string | null; city: string | null; phone: string | null;
}

const SIZE_LABELS: Record<string, string> = { small: "صغير", medium: "متوسط", large: "كبير" };

export default function Storefront() {
  const { merchantId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [merchantBlocked, setMerchantBlocked] = useState(false);

  useEffect(() => {
    if (!merchantId) return;
    // Use secure RPC function — returns only safe public fields (no phone, no balance, no docs)
    supabase.rpc("get_public_merchant_info", { p_merchant_user_id: merchantId }).then(({ data: m, error }) => {
      if (error || !m) {
        setMerchantBlocked(true);
        setLoading(false);
        return;
      }
      const merchant = m as any;
      if (!merchant.is_active || merchant.verification_status !== "verified") {
        setMerchantBlocked(true);
        setLoading(false);
        return;
      }
      setMerchant({ store_name: merchant.store_name, city: merchant.city, phone: null });
      supabase.from("products").select("*").eq("merchant_id", merchantId).eq("is_active", true)
        .order("created_at", { ascending: false }).then(({ data: prods }) => {
          if (prods) setProducts(prods as any);
          setLoading(false);
        });
    });
  }, [merchantId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  if (merchantBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full border-border">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-display font-bold text-foreground">المتجر غير متاح حالياً</h2>
            <p className="text-sm text-muted-foreground">هذا المتجر لم يكمل عملية التحقق بعد أو غير مفعّل.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">{merchant?.store_name || "متجر"}</span>
          </div>
          {merchant?.city && <span className="text-sm text-muted-foreground">{merchant.city}</span>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <Link key={p.id} to={`/product/${p.slug || p.id}`}>
                <Card className="border-border hover:border-primary/30 transition-all overflow-hidden group cursor-pointer h-full">
                  <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">{p.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-primary font-display font-bold text-sm">{Number(p.price).toLocaleString()} ل.س</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
