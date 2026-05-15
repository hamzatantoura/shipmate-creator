import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, Package, ShieldAlert, Share2, ExternalLink, MessageCircle } from "lucide-react";
import { Seo } from "@/shared/seo/Seo";
import { toast } from "sonner";

interface Product {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; slug: string | null;
}

interface PublicMerchant {
  user_id: string;
  store_name: string | null;
  city: string | null;
  logo_url: string | null;
  whatsapp_number: string | null;
  external_website_url: string | null;
  store_slug: string | null;
  is_active: boolean;
  verification_status: string;
}

export default function PublicStorefront() {
  const { slug } = useParams();
  const [merchant, setMerchant] = useState<PublicMerchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.rpc("get_public_merchant_by_slug" as any, { p_slug: slug }).then(({ data, error }) => {
      if (error || !data) { setBlocked(true); setLoading(false); return; }
      const m = data as any as PublicMerchant;
      if (!m.is_active || m.verification_status !== "verified") {
        setBlocked(true); setLoading(false); return;
      }
      setMerchant(m);
      supabase.from("products")
        .select("id, name, description, image_url, price, slug")
        .eq("merchant_id", m.user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .then(({ data: prods }) => {
          if (prods) setProducts(prods as any);
          setLoading(false);
        });
    });
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  if (blocked || !merchant) {
    return (
      <>
        <Seo title="المتجر غير متاح | صلة" description="هذا المتجر غير موجود أو لم يكتمل تفعيله بعد." index={false} />
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4" dir="rtl">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3 shadow-sm">
            <ShieldAlert className="h-12 w-12 text-zinc-400 mx-auto" />
            <h2 className="text-xl font-display font-bold text-zinc-900">المتجر غير متاح</h2>
            <p className="text-sm text-zinc-600">هذا المتجر غير موجود أو لم يكتمل تفعيله بعد.</p>
          </div>
        </div>
      </>
    );
  }

  const storeName = merchant.store_name || "متجر";
  const seoTitle = `${storeName} | صلة`;
  const seoDesc = `تسوّق منتجات ${storeName}${merchant.city ? ` في ${merchant.city}` : ""} مع شحن سريع وموثوق عبر منصة صلة.`;
  const firstImage = products.find((p) => p.image_url)?.image_url || merchant.logo_url || undefined;
  const storeUrl = typeof window !== "undefined"
    ? window.location.href
    : `https://sila-sy.com/s/${merchant.store_slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: storeName,
    url: storeUrl,
    ...(merchant.logo_url ? { logo: merchant.logo_url } : {}),
    ...(merchant.city ? { address: { "@type": "PostalAddress", addressLocality: merchant.city, addressCountry: "SY" } } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: storeName,
      itemListElement: products.slice(0, 30).map((p, i) => ({
        "@type": "Offer",
        position: i + 1,
        itemOffered: {
          "@type": "Product",
          name: p.name,
          ...(p.image_url ? { image: p.image_url } : {}),
          url: `${typeof window !== "undefined" ? window.location.origin : "https://sila-sy.com"}/product/${p.slug || p.id}`,
        },
        price: p.price,
        priceCurrency: "SYP",
      })),
    },
  };

  const sharePage = async () => {
    const data = { title: storeName, text: seoDesc, url: storeUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(storeUrl); toast.success("تم نسخ رابط المتجر"); }
    } catch { /* user cancelled */ }
  };

  const buyViaWhatsApp = (p: Product) => {
    const num = (merchant.whatsapp_number || "").replace(/[^0-9]/g, "");
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://sila-sy.com"}/product/${p.slug || p.id}`;
    const text = `مرحباً، أرغب بطلب:\n${p.name}\nالسعر: ${Number(p.price).toLocaleString()} ل.س\n${url}`;
    const wa = num
      ? `https://wa.me/${num.startsWith("963") ? num : `963${num.replace(/^0/, "")}`}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  };

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      <Seo title={seoTitle} description={seoDesc} image={firstImage} type="website" jsonLd={jsonLd} canonical={storeUrl} />

      {/* Hero header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {merchant.logo_url ? (
              <img src={merchant.logo_url} alt={storeName} className="h-10 w-10 rounded-full object-cover border border-zinc-200" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg text-zinc-900 truncate">{storeName}</h1>
              {merchant.city && <p className="text-xs text-zinc-500 truncate">{merchant.city}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {merchant.external_website_url && (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5 border-zinc-200 text-zinc-700">
                <a href={merchant.external_website_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> الموقع الرسمي
                </a>
              </Button>
            )}
            <Button onClick={sharePage} variant="outline" size="sm" className="gap-1.5 border-zinc-200 text-zinc-700">
              <Share2 className="h-3.5 w-3.5" /> مشاركة
            </Button>
          </div>
        </div>
        {merchant.external_website_url && (
          <div className="sm:hidden border-t border-zinc-100 px-4 py-2">
            <a
              href={merchant.external_website_url}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5" /> زيارة الموقع الرسمي
            </a>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {products.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map((p, idx) => (
              <article
                key={p.id}
                className="group flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <Link to={`/product/${p.slug || p.id}`} className="block">
                  <div className="aspect-square bg-zinc-50 overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading={idx < 4 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={idx === 0 ? "high" : "auto"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <Package className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <Link to={`/product/${p.slug || p.id}`}>
                    <h3 className="font-semibold text-sm text-zinc-900 line-clamp-2 leading-snug min-h-[2.5rem] hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                  </Link>
                  <span className="inline-flex w-fit items-center bg-primary/10 text-primary font-display font-bold text-sm px-2 py-1 rounded-md">
                    {Number(p.price).toLocaleString()} ل.س
                  </span>
                  <div className="flex gap-1.5 mt-auto pt-1">
                    <Button
                      onClick={() => buyViaWhatsApp(p)}
                      size="sm"
                      className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> اشتري عبر واتساب
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 border-zinc-200 text-zinc-700 px-2 text-xs"
                    >
                      <Link to={`/product/${p.slug || p.id}`}>التفاصيل</Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}