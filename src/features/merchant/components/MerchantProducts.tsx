import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Package, Loader2, ImagePlus, Trash2, Copy, Share2, ExternalLink, Pencil, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { compressImage } from "@/shared/lib/image-compress";
import ProductVariantsForm, { VariantEntry } from "./ProductVariantsForm";
import { usePlatformSettings } from "@/shared/hooks/use-platform-settings";
import { useMerchantApproval } from "@/features/merchant/hooks/use-merchant-approval";

interface Product {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; stock: number; is_active: boolean; created_at: string;
  weight_kg: number; slug: string | null;
  length_cm: number; width_cm: number; height_cm: number;
  original_price: number | null; in_stock: boolean; category: string | null;
}

interface ProductImage {
  id: string; product_id: string; image_url: string; sort_order: number;
}

function generateSlug(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, "") + "-" + Date.now().toString(36);
}

export default function MerchantProducts() {
  const { user } = useAuth();
  const { settings: platformSettings } = usePlatformSettings();
  const { isApproved } = useMerchantApproval();
  const maxImages = platformSettings.product_max_images || 5;
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", price: "", original_price: "", stock: "0", description: "",
    weight_kg: "1", length_cm: "0", width_cm: "0", height_cm: "0",
    category: "", in_stock: true,
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<VariantEntry[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("products").select("*").eq("merchant_id", user.id).order("created_at", { ascending: false });
    if (data) {
      setProducts(data as any);
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

  const resetForm = () => {
    setForm({
      name: "", price: "", original_price: "", stock: "0", description: "",
      weight_kg: "1", length_cm: "0", width_cm: "0", height_cm: "0",
      category: "", in_stock: true,
    });
    setImageFiles([]); setVariants([]); setEditingProduct(null);
  };

  const openAddDialog = () => { resetForm(); setOpen(true); };

  const openEditDialog = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      stock: String(p.stock),
      description: p.description || "", weight_kg: String(p.weight_kg),
      length_cm: String(p.length_cm || 0), width_cm: String(p.width_cm || 0), height_cm: String(p.height_cm || 0),
      category: p.category || "", in_stock: p.in_stock,
    });
    setImageFiles([]); setVariants([]); setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const productData = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price) || 0,
        original_price: form.original_price.trim() ? parseFloat(form.original_price) : null,
        category: form.category.trim() || null,
        in_stock: form.in_stock,
        stock: parseInt(form.stock) || 0,
        weight_kg: parseFloat(form.weight_kg) || 1,
        length_cm: parseFloat(form.length_cm) || 0,
        width_cm: parseFloat(form.width_cm) || 0,
        height_cm: parseFloat(form.height_cm) || 0,
        // Pending merchants can add products but they stay as drafts
        // (is_active=false) until the account is verified by an admin.
        ...(isApproved ? {} : { is_active: false }),
      };

      if (editingProduct) {
        let image_url = editingProduct.image_url;
        if (imageFiles.length > 0) {
          const compressed = await compressImage(imageFiles[0]);
          const ext = compressed.name.split(".").pop();
          const path = `${user.id}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("product-images").upload(path, compressed);
          if (upErr) { toast.error("فشل رفع الصورة"); setLoading(false); return; }
          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
          image_url = pub.publicUrl;
        }

        const { error } = await supabase.from("products").update({ ...productData, image_url } as any).eq("id", editingProduct.id);
        if (error) { toast.error(error.message); setLoading(false); return; }

        // Replace variants when editing
        await supabase.from("product_variants" as any).delete().eq("product_id", editingProduct.id);
        if (variants.length > 0) {
          const rows = variants.map(v => ({
            product_id: editingProduct.id, variant_type: v.variant_type,
            variant_value: v.variant_value, price_adjustment: v.price_adjustment, stock: v.stock,
          }));
          await supabase.from("product_variants" as any).insert(rows as any);
        }
        toast.success("تم تعديل المنتج بنجاح!");
      } else {
        let image_url: string | null = null;
        const slug = generateSlug(form.name);

        if (imageFiles.length > 0) {
          const compressed = await compressImage(imageFiles[0]);
          const ext = compressed.name.split(".").pop();
          const path = `${user.id}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("product-images").upload(path, compressed);
          if (upErr) { toast.error("فشل رفع الصورة"); setLoading(false); return; }
          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
          image_url = pub.publicUrl;
        }

        const { data: product, error } = await supabase.from("products").insert({
          merchant_id: user.id, ...productData, image_url, slug,
        } as any).select().single();

        if (error) { toast.error(error.message); setLoading(false); return; }

        if (product && imageFiles.length > 1) {
          for (let i = 0; i < imageFiles.length; i++) {
            const compressed = await compressImage(imageFiles[i]);
            const ext = compressed.name.split(".").pop();
            const path = `${user.id}/${Date.now()}-${i}.${ext}`;
            const { error: upErr } = await supabase.storage.from("product-images").upload(path, compressed);
            if (!upErr) {
              const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
              await supabase.from("product_images").insert({ product_id: (product as any).id, image_url: pub.publicUrl, sort_order: i } as any);
            }
          }
        }

        if (product && variants.length > 0) {
          const variantRows = variants.map(v => ({
            product_id: (product as any).id, variant_type: v.variant_type,
            variant_value: v.variant_value, price_adjustment: v.price_adjustment, stock: v.stock,
          }));
          await supabase.from("product_variants" as any).insert(variantRows as any);
        }

        toast.success("تم إضافة المنتج بنجاح!");
      }

      resetForm(); setOpen(false); fetchProducts();
    } catch (err) { toast.error("حدث خطأ غير متوقع"); }
    setLoading(false);
  };

  const deleteProduct = async (id: string) => {
    // Soft delete — set deleted_at timestamp instead of actually deleting
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم حذف المنتج"); fetchProducts(); }
  };

  const toggleVisibility = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active } as any).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(!p.is_active ? "تم إظهار المنتج" : "تم إخفاء المنتج");
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
    }
  };

  const getProductUrl = (p: Product) => `${window.location.origin}/product/${p.slug || p.id}`;
  const getStoreUrl = () => `${window.location.origin}/store/${user?.id}`;
  const copyLink = (url: string) => { navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); };

  const shareWhatsApp = (p: Product) => {
    const url = getProductUrl(p);
    const text = `${p.name}\nالسعر: ${Number(p.price).toLocaleString()} ل.س\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-semibold text-lg text-foreground">المنتجات</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyLink(getStoreUrl())}>
            <ExternalLink className="h-3.5 w-3.5" /> رابط المتجر
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 glow-btn" onClick={openAddDialog}><Plus className="h-4 w-4" /> إضافة منتج</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader><DialogTitle>{editingProduct ? "تعديل المنتج" : "منتج جديد"}</DialogTitle></DialogHeader>
              {!isApproved && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-200 font-medium">
                  سيُحفظ هذا المنتج كمسودة وسيُنشر تلقائياً فور تفعيل حسابك من الإدارة.
                </div>
              )}
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
                    <Label>سعر البيع (ل.س)</Label>
                    <Input type="number" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>السعر الأصلي <span className="text-muted-foreground text-[10px]">(اختياري)</span></Label>
                    <Input type="number" min="0" value={form.original_price}
                      onChange={e => setForm({...form, original_price: e.target.value})}
                      placeholder="قبل الخصم" />
                  </div>
                  <div className="space-y-2">
                    <Label>الوزن (كغ)</Label>
                    <Input type="number" min="0.1" step="0.1" value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} required />
                  </div>
                </div>

                {form.original_price && parseFloat(form.original_price) > parseFloat(form.price || "0") && parseFloat(form.price || "0") > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-1.5 font-semibold">
                    خصم {Math.round(((parseFloat(form.original_price) - parseFloat(form.price)) / parseFloat(form.original_price)) * 100)}% — سيظهر شارة تخفيض على البطاقة
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>التصنيف</Label>
                    <Input value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                      placeholder="ملابس، إلكترونيات..." list="merchant-categories" />
                    <datalist id="merchant-categories">
                      {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(c => (
                        <option key={c as string} value={c as string} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>المخزون</Label>
                    <Input type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2">
                  <div>
                    <Label className="text-sm">الحالة: {form.in_stock ? "متوفر" : "غير متوفر"}</Label>
                    <p className="text-[11px] text-muted-foreground">عند الإيقاف يظهر "غير متوفر" على البطاقة.</p>
                  </div>
                  <Switch checked={form.in_stock} onCheckedChange={(v) => setForm({...form, in_stock: v})} />
                </div>

                {/* Dimensions for volumetric weight */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">أبعاد الطرد (سم) — لحساب الوزن الحجمي</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">الطول</Label>
                      <Input type="number" min="0" step="1" value={form.length_cm} onChange={e => setForm({...form, length_cm: e.target.value})} placeholder="سم" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">العرض</Label>
                      <Input type="number" min="0" step="1" value={form.width_cm} onChange={e => setForm({...form, width_cm: e.target.value})} placeholder="سم" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">الارتفاع</Label>
                      <Input type="number" min="0" step="1" value={form.height_cm} onChange={e => setForm({...form, height_cm: e.target.value})} placeholder="سم" />
                    </div>
                  </div>
                </div>

                <ProductVariantsForm variants={variants} onChange={setVariants} />
                <div className="space-y-2">
                  <Label>{editingProduct ? "تغيير صورة المنتج (اختياري)" : "صور المنتج (يمكنك اختيار عدة صور)"}</Label>
                  <Input type="file" accept="image/*" multiple={!editingProduct} onChange={e => {
                    const files = Array.from(e.target.files || []);
                    if (!editingProduct && files.length > maxImages) {
                      toast.error(`الحد الأقصى ${maxImages} صور لكل منتج`);
                      setImageFiles(files.slice(0, maxImages));
                    } else {
                      setImageFiles(files);
                    }
                  }} />
                  {imageFiles.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground">{imageFiles.length} / {maxImages} صورة محددة</p>
                      <div className="grid grid-cols-4 gap-2">
                        {imageFiles.map((f, i) => (
                          <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                            <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                            <button type="button"
                              onClick={() => setImageFiles(imageFiles.filter((_, j) => j !== i))}
                              className="absolute top-1 end-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <Button type="submit" disabled={loading} className="w-full glow-btn">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : editingProduct ? <Pencil className="h-4 w-4 ml-2" /> : <Plus className="h-4 w-4 ml-2" />}
                  {editingProduct ? "حفظ التعديلات" : "إضافة المنتج"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="font-display font-semibold text-lg text-foreground">ابدأ ببناء متجرك</h3>
            <p className="text-sm text-muted-foreground">أضف منتجك الأول ليصبح متجرك جاهزاً لاستقبال الطلبات من الزبائن.</p>
          </div>
          <Button onClick={openAddDialog} className="gap-2 glow-btn mt-1">
            <Plus className="h-4 w-4" />
            أضف منتجك الأول
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => {
            const images = productImages[p.id] || [];
            const displayImage = p.image_url || images[0]?.image_url;
            const hasDiscount = p.original_price && p.original_price > p.price;
            const discountPct = hasDiscount
              ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100)
              : 0;
            return (
              <Card key={p.id} className={`bg-card border-border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 duration-300 ${!p.is_active ? "opacity-60" : ""}`}>
                <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden relative">
                  {displayImage ? (
                    <img src={displayImage} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="h-10 w-10 text-muted-foreground/30" />
                  )}
                  {hasDiscount && (
                    <span className="absolute top-2 start-2 bg-destructive text-destructive-foreground text-[11px] font-bold px-2 py-0.5 rounded-md shadow">
                      %{discountPct}-
                    </span>
                  )}
                  {!p.in_stock && (
                    <span className="absolute top-2 end-2 bg-muted text-foreground text-[11px] font-semibold px-2 py-0.5 rounded-md border border-border">
                      غير متوفر
                    </span>
                  )}
                  {images.length > 1 && (
                    <span className="absolute bottom-2 left-2 bg-foreground/70 text-background text-xs px-2 py-0.5 rounded-full">+{images.length - 1}</span>
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground line-clamp-1">{p.name}</h3>
                    {p.category && <Badge variant="outline" className="text-[10px] shrink-0">{p.category}</Badge>}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-primary font-display font-bold">{Number(p.price).toLocaleString()} ل.س</span>
                      {hasDiscount && (
                        <span className="text-muted-foreground text-xs line-through">{Number(p.original_price).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{p.weight_kg} كغ</span>
                      <span>المخزون: {p.stock}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      {p.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {p.is_active ? "ظاهر للزبائن" : "مخفي"}
                    </span>
                    <Switch checked={p.is_active} onCheckedChange={() => toggleVisibility(p)} />
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditDialog(p)}>
                      <Pencil className="h-3 w-3" /> تعديل
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => copyLink(getProductUrl(p))}>
                      <Copy className="h-3 w-3" /> نسخ الرابط
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => shareWhatsApp(p)}>
                      <Share2 className="h-3 w-3" />
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => setConfirmDelete(p)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{confirmDelete?.name}"؟ لن يظهر بعد ذلك في متجرك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmDelete) await deleteProduct(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
