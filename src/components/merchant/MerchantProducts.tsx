import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Package, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { useMerchantId } from "@/hooks/use-merchant-id";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
}

export default function MerchantProducts() {
  const merchantId = useMerchantId();
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", stock: "0" });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (data) setProducts(data as Product[]);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let image_url: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `products/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, imageFile);
      if (upErr) { toast.error("فشل رفع الصورة"); setLoading(false); return; }
      const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);
      image_url = pub.publicUrl;
    }
    const { error } = await supabase.from("products").insert({
      merchant_id: merchantId, name: form.name.trim(),
      price: parseFloat(form.price) || 0, stock: parseInt(form.stock) || 0, image_url,
    } as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة المنتج بنجاح!");
    setForm({ name: "", price: "", stock: "0" }); setImageFile(null); setOpen(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم حذف المنتج"); fetchProducts(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg text-foreground">المنتجات</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> إضافة منتج</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>منتج جديد</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>اسم المنتج</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>السعر (ل.س)</Label><Input type="number" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required /></div>
                <div className="space-y-2"><Label>المخزون</Label><Input type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>صورة المنتج</Label><Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} /></div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="h-4 w-4 ml-2" />} إضافة المنتج
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-40" /><p>لا توجد منتجات بعد.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <Card key={p.id} className="bg-card border-border overflow-hidden">
              <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <ImagePlus className="h-10 w-10 text-muted-foreground/30" />}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1">{p.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-display font-bold">{Number(p.price).toLocaleString()} ل.س</span>
                  <span className="text-xs text-muted-foreground">المخزون: {p.stock}</span>
                </div>
                <Button variant="destructive" size="sm" className="gap-1 w-full mt-3" onClick={() => deleteProduct(p.id)}>
                  <Trash2 className="h-3 w-3" /> حذف
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
