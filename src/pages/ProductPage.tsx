import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShoppingCart, Package, Loader2, MapPin, Share2, Check } from "lucide-react";

interface Product {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; merchant_id: string; size_category: string; slug: string | null;
}

interface ProductImage {
  id: string; image_url: string; sort_order: number;
}

const SIZE_LABELS: Record<string, string> = { small: "صغير", medium: "متوسط", large: "كبير" };

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    receiver_name: "", phone_number: "", city: "", detailed_address: "", quantity: "1",
  });
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    // Try slug first, then id
    supabase.from("products").select("*").eq("slug", slug).single().then(async ({ data, error }) => {
      let prod = data;
      if (error || !data) {
        const res = await supabase.from("products").select("*").eq("id", slug).single();
        prod = res.data;
      }
      if (prod) {
        setProduct(prod as any);
        setMainImage((prod as any).image_url);
        // Fetch additional images
        const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", (prod as any).id).order("sort_order");
        if (imgs) setImages(imgs as ProductImage[]);
      }
      setLoading(false);
    });
  }, [slug]);

  const getLocation = () => {
    if (!navigator.geolocation) { toast.error("المتصفح لا يدعم تحديد الموقع"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerLat(pos.coords.latitude);
        setCustomerLng(pos.coords.longitude);
        toast.success("تم تحديد موقعك بنجاح");
      },
      () => toast.error("لم نتمكن من تحديد موقعك")
    );
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!form.receiver_name.trim() || !form.phone_number.trim()) {
      toast.error("الاسم ورقم الهاتف مطلوبان"); return;
    }
    setSubmitting(true);
    const qty = parseInt(form.quantity) || 1;
    const { error } = await supabase.from("orders").insert({
      merchant_id: product.merchant_id,
      product_id: product.id,
      quantity: qty,
      total_amount: product.price * qty,
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: form.city.trim() || "غير محدد",
      detailed_address: form.detailed_address.trim() || "غير محدد",
      customer_lat: customerLat,
      customer_lng: customerLng,
    } as any);
    setSubmitting(false);
    if (error) { toast.error("فشل إرسال الطلب"); return; }
    setSubmitted(true);
    toast.success("تم إرسال طلبك بنجاح!");
  };

  const shareWhatsApp = () => {
    if (!product) return;
    const url = window.location.href;
    const text = `${product.name}\nالسعر: ${Number(product.price).toLocaleString()} ل.س\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">المنتج غير موجود</div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">تم إرسال طلبك بنجاح!</h2>
            <p className="text-muted-foreground text-sm">سيتواصل معك التاجر قريباً لتأكيد الطلب وترتيب الشحن.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allImages = product.image_url ? [product.image_url, ...images.filter(i => i.image_url !== product.image_url).map(i => i.image_url)] : images.map(i => i.image_url);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-3">
            <div className="aspect-square bg-muted/30 rounded-xl overflow-hidden border border-border">
              {mainImage ? (
                <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setMainImage(img)}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${mainImage === img ? 'border-primary' : 'border-border'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info + Order Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">{product.name}</h1>
              <p className="text-2xl font-display font-bold text-primary">{Number(product.price).toLocaleString()} ل.س</p>
              <span className="text-xs text-muted-foreground">الحجم: {SIZE_LABELS[product.size_category]}</span>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{product.description}</p>
              )}
            </div>

            <Button variant="outline" size="sm" className="gap-2" onClick={shareWhatsApp}>
              <Share2 className="h-3.5 w-3.5" /> مشاركة عبر واتساب
            </Button>

            <Card className="border-primary/20">
              <CardContent className="p-5">
                <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" /> اطلب الآن
                </h3>
                <form onSubmit={handleOrder} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>الاسم الكامل *</Label>
                    <Input value={form.receiver_name} onChange={e => setForm({...form, receiver_name: e.target.value})} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>رقم الهاتف *</Label>
                    <Input value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} required placeholder="+963 9XX XXX XXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>المدينة</Label>
                    <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="دمشق" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>العنوان التفصيلي</Label>
                    <Textarea value={form.detailed_address} onChange={e => setForm({...form, detailed_address: e.target.value})} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>الكمية</Label>
                      <Input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>موقعك</Label>
                      <Button type="button" variant="outline" className="w-full gap-1.5" onClick={getLocation}>
                        <MapPin className="h-3.5 w-3.5" />
                        {customerLat ? "تم التحديد ✓" : "حدد موقعك"}
                      </Button>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">الإجمالي</span>
                      <span className="font-display font-bold text-primary text-lg">
                        {(product.price * (parseInt(form.quantity) || 1)).toLocaleString()} ل.س
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">الدفع عند الاستلام (COD) فقط</p>
                    <Button type="submit" disabled={submitting} className="w-full glow-btn">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShoppingCart className="h-4 w-4 ml-2" />}
                      تأكيد الطلب
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
