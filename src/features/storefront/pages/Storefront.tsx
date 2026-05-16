import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ShieldAlert } from "lucide-react";
import { Seo } from "@/shared/seo/Seo";
import StoreHero from "../components/StoreHero";
import CategoryFilter from "../components/CategoryFilter";
import StorefrontProductCard from "../components/StorefrontProductCard";
import { CartProvider, useCart } from "../cart/CartContext";
import CartDrawer from "../cart/CartDrawer";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface Product {
  id: string; name: string; image_url: string | null;
  price: number; original_price: number | null; slug: string | null;
  in_stock: boolean; category: string | null;
}

interface MerchantInfo {
  store_name: string; city: string | null;
  logo_url: string | null; banner_url: string | null;
  bio: string | null; operating_hours: string | null;
  whatsapp_number: string | null;
  social_links: Record<string, string> | null;
  external_website_url: string | null;
}

export default function Storefront() {
  const { merchantId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [merchantBlocked, setMerchantBlocked] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    supabase.rpc("get_public_merchant_info", { p_merchant_user_id: merchantId }).then(({ data: m, error }) => {
      if (error || !m) { setMerchantBlocked(true); setLoading(false); return; }
      const info = m as any;
      if (!info.is_active || info.verification_status !== "verified") {
        setMerchantBlocked(true); setLoading(false); return;
      }
      setMerchant({
        store_name: info.store_name || "متجر",
        city: info.city,
        logo_url: info.logo_url,
        banner_url: info.banner_url,
        bio: info.bio,
        operating_hours: info.operating_hours,
        whatsapp_number: info.whatsapp_number,
        social_links: info.social_links || null,
        external_website_url: info.external_website_url || null,
      });
      supabase.from("products")
        .select("id, name, image_url, price, original_price, slug, in_stock, category")
        .eq("merchant_id", merchantId).eq("is_active", true)
        .order("created_at", { ascending: false })
        .then(({ data: prods }) => {
          if (prods) setProducts(prods as any);
          setLoading(false);
        });
    });
  }, [merchantId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category && p.category.trim()) set.add(p.category.trim()); });
    return Array.from(set);
  }, [products]);

  const visibleProducts = useMemo(
    () => activeCategory ? products.filter(p => p.category === activeCategory) : products,
    [products, activeCategory],
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  if (merchantBlocked) {
    return (
      <>
        <Seo title="المتجر غير متاح | صلة" description="هذا المتجر لم يكمل عملية التحقق بعد أو غير مفعّل." index={false} />
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full border-border">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-display font-bold text-foreground">المتجر غير متاح حالياً</h2>
            <p className="text-sm text-muted-foreground">هذا المتجر لم يكمل عملية التحقق بعد أو غير مفعّل.</p>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  const storeName = merchant?.store_name || "متجر";
  const seoTitle = `${storeName} | صلة`;
  const seoDesc = `تسوّق منتجات ${storeName}${merchant?.city ? ` في ${merchant.city}` : ""} مع شحن سريع وموثوق عبر منصة صلة.`;
  const firstImage = merchant?.banner_url || merchant?.logo_url || products.find((p) => p.image_url)?.image_url || undefined;
  const storeUrl = typeof window !== "undefined" ? window.location.href : `https://sila-sy.com/store/${merchantId}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: storeName,
    url: storeUrl,
    ...(merchant?.city ? { address: { "@type": "PostalAddress", addressLocality: merchant.city, addressCountry: "SY" } } : {}),
    ...(firstImage ? { image: firstImage } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: storeName,
      itemListElement: products.slice(0, 24).map((p, i) => ({
        "@type": "Offer",
        position: i + 1,
        itemOffered: { "@type": "Product", name: p.name, url: `${window.location.origin}/product/${p.slug || p.id}` },
        price: p.price,
        priceCurrency: "SYP",
      })),
    },
  };

  return (
    <CartProvider merchantId={merchantId!}>
    <div className="min-h-screen bg-background" dir="rtl">
      <Seo
        title={seoTitle}
        description={seoDesc}
        image={firstImage}
        type="website"
        jsonLd={jsonLd}
      />
      <FloatingCartButton />
      {merchant && (
        <StoreHero
          merchantId={merchantId!}
          storeName={merchant.store_name}
          bio={merchant.bio}
          city={merchant.city}
          bannerUrl={merchant.banner_url}
          logoUrl={merchant.logo_url}
          operatingHours={merchant.operating_hours}
          whatsappNumber={merchant.whatsapp_number}
          socialLinks={merchant.social_links}
          websiteUrl={merchant.external_website_url}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 pb-12">
        <CategoryFilter categories={categories} active={activeCategory} onChange={setActiveCategory} />

        {visibleProducts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mt-6">
            {visibleProducts.map((p, idx) => (
              <StorefrontProductCard key={p.id} product={p} eager={idx < 4} />
            ))}
          </div>
        )}
      </main>
      <CartDrawer merchantId={merchantId!} />
    </div>
    </CartProvider>
  );
}

function FloatingCartButton() {
  const cart = useCart();
  return (
    <Button
      onClick={cart.openCart}
      size="icon"
      className="fixed top-4 left-4 z-40 h-12 w-12 rounded-full shadow-lg relative"
      aria-label="فتح سلة المشتريات"
    >
      <ShoppingCart className="h-5 w-5" />
      {cart.count > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
          {cart.count}
        </span>
      )}
    </Button>
  );
}
