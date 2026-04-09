import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Package, Loader2, ImagePlus, Trash2, Copy, Share2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import ProductVariantsForm, { VariantEntry } from "./ProductVariantsForm";

interface Product {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; stock: number; is_active: boolean; created_at: string;
  weight_kg: number; slug: string | null;
}

interface ProductImage {
  id: string; product_id: string; image_url: string; sort_order: number;
}



function generateSlug(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, "") + "-" + Date.now().toString(36);
}

export default function MerchantProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", stock: "0", description: "", weight_kg: "1" });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [shareOpen, setShareOpen] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantEntry[]>([]);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("products").select("*").eq("merchant_id", user.id).order("created_at", { ascending: false });
    if (data) {
      setProducts(data as any);
      // Fetch images for all products
      const ids = data.map((p: any) => p.id);
      if (ids.length > 0) {
        const { data: imgs } = await supabase.from("product_images").select("*").in("product_id", ids).order("sort_order");
        if (imgs) {
          const map: Record<string, ProductImage[]> = {};
          (imgs as ProductImage[]).forEach(img => {
            if (!map[img.product_id]) map[img.product_id] = [];
            map[img.product_id].push(img);
          });
          setProductImages(map);
        }
      }
    }
  }, [user]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      let image_url: string | null = null;
      const slug = generateSlug(form.name);

      // Upload first image as main image to product-images bucket
      if (imageFiles.length > 0) {
        const ext = imageFiles[0].name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, imageFiles[0]);
        if (upErr) { toast.error("فشل رفع الصورة"); setLoading(false); return; }
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        image_url = pub.publicUrl;
      }

      const { data: product, error } = await supabase.from("products").insert({
        merchant_id: user.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock) || 0,
        image_url,
        weight_kg: parseFloat(form.weight_kg) || 1,
        slug,
      } as any).select().single();

      if (error) { toast.error(error.message); setLoading(false); return; }

      // Upload additional images to product-images bucket
      if (product && imageFiles.length > 1) {
        for (let i = 0; i < imageFiles.length; i++) {
          const ext = imageFiles[i].name.split(".").pop();
          const path = `${user.id}/${Date.now()}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from("product-images").upload(path, imageFiles[i]);
          if (!upErr) {
            const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
            await supabase.from("product_images").insert({
              product_id: (product as any).id,
              image_url: pub.publicUrl,
              sort_order: i,
            } as any);
          }
        }
      }

      // Save variants
      if (product && variants.length > 0) {
        const variantRows = variants.map(v => ({
          product_id: (product as any).id,
          variant_type: v.variant_type,
          variant_value: v.variant_value,
          price_adjustment: v.price_adjustment,
          stock: v.stock,
        }));
        await supabase.from("product_variants" as any).insert(variantRows as any);
      }

      toast.success("تم إضافة المنتج بنجاح!");
      setForm({ name: "", price: "", stock: "0", description: "", weight_kg: "1" });
      setImageFiles([]); setVariants([]); setOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error("حدث خطأ غير متوقع");
    }
    setLoading(false);
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم حذف المنتج"); fetchProducts(); }
  };

  const getProductUrl = (p: Product) => {
    return `${window.location.origin}/product/${p.slug || p.id}`;
  };

  const getStoreUrl = () => {
    return `${window.location.origin}/store/${user?.id}`;
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ الرابط");
  };

  const shareWhatsApp = (p: Product) => {
    const url = getProductUrl(p);
    const text = `${p.name}\nالسعر: ${Number(p.price).toLocaleString()} ل.س\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareFacebook = (p: Product) => {
    const url = getProductUrl(p);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-semibold text-lg text-foreground">المنتجات</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyLink(getStoreUrl())}>
            <ExternalLink className="h-3.5 w-3.5" /> رابط المتجر
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 glow-btn"><Plus className="h-4 w-4" /> إضافة منتج</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader><DialogTitle>منتج جديد</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم المنتج</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="وصف المنتج..." rows={3} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>السعر (ل.س)</Label>
                    <Input type="number" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>المخزون</Label>
                    <Input type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>الوزن (كغ)</Label>
                    <Input type="number" min="0.1" step="0.1" value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} required />
                  </div>
                </div>
                <ProductVariantsForm variants={variants} onChange={setVariants} />
                <div className="space-y-2">
                  <Label>صور المنتج (يمكنك اختيار عدة صور)</Label>
                  <Input type="file" accept="image/*" multiple onChange={e => setImageFiles(Array.from(e.target.files || []))} />
                  {imageFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground">{imageFiles.length} صورة محددة</p>
                  )}
                </div>
                <Button type="submit" disabled={loading} className="w-full glow-btn">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="h-4 w-4 ml-2" />} إضافة المنتج
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-40" /><p>لا توجد منتجات بعد.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => {
            const images = productImages[p.id] || [];
            const displayImage = p.image_url || images[0]?.image_url;
            return (
              <Card key={p.id} className="bg-card border-border overflow-hidden">
                <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden relative">
                  {displayImage ? (
                    <img src={displayImage} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="h-10 w-10 text-muted-foreground/30" />
                  )}
                  {images.length > 1 && (
                    <span className="absolute bottom-2 left-2 bg-foreground/70 text-background text-xs px-2 py-0.5 rounded-full">
                      +{images.length - 1}
                    </span>
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-display font-bold">{Number(p.price).toLocaleString()} ل.س</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{p.weight_kg} كغ</span>
                      <span>المخزون: {p.stock}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => copyLink(getProductUrl(p))}>
                      <Copy className="h-3 w-3" /> نسخ الرابط
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => shareWhatsApp(p)}>
                      <Share2 className="h-3 w-3" />
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => deleteProduct(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
