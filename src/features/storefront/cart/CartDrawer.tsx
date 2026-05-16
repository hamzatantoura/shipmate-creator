import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, Check, Package } from "lucide-react";
import { useCart } from "./CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";
import { SyrianPhoneInput } from "@/shared/components/inputs/SyrianPhoneInput";
import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";

interface Props { merchantId: string; }

interface District {
  id: string; name: string; province_ar: string | null;
  parent_id: string | null; delivery_fee: number;
}

export default function CartDrawer({ merchantId }: Props) {
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [success, setSuccess] = useState<{ ids: string[]; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [districts, setDistricts] = useState<District[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  useEffect(() => {
    supabase.from("districts")
      .select("id, name, province_ar, parent_id, delivery_fee")
      .eq("is_active", true).order("name")
      .then(({ data }) => { if (data) setDistricts(data as any); });
  }, []);

  const provinces = districts.filter(d => !d.parent_id);
  const areas = provinceId ? districts.filter(d => d.parent_id === provinceId) : [];
  const finalDistrictId = areaId || provinceId;

  const submitOrder = async () => {
    if (!form.name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!isValidSyrianPhone(form.phone)) { toast.error("رقم الهاتف غير صحيح"); return; }
    if (!provinceId) { toast.error("اختر المحافظة"); return; }
    if (areas.length > 0 && !areaId) { toast.error("اختر المنطقة"); return; }
    if (!form.address.trim()) { toast.error("العنوان مطلوب"); return; }
    if (cart.items.length === 0) return;

    setSubmitting(true);
    const ids: string[] = [];
    let totalSum = 0;
    try {
      for (const item of cart.items) {
        const { data, error } = await supabase.rpc("create_storefront_order" as any, {
          p_merchant_id: merchantId,
          p_product_id: item.id,
          p_quantity: item.quantity,
          p_district_id: finalDistrictId,
          p_receiver_name: form.name.trim(),
          p_phone_number: form.phone.trim(),
          p_detailed_address: form.address.trim(),
        });
        if (error) throw error;
        const res = data as { order_id?: string; total_amount?: number; delivery_fee?: number } | null;
        if (res?.order_id) ids.push(res.order_id.slice(0, 8).toUpperCase());
        totalSum += Number(res?.total_amount ?? item.price * item.quantity) + Number(res?.delivery_fee ?? 0);
      }
      setSuccess({ ids, total: totalSum });
      cart.clear();
      setCheckoutOpen(false);
      toast.success("تم إرسال طلبك بنجاح!");
    } catch (e: any) {
      toast.error("فشل إرسال الطلب: " + (e.message || "خطأ"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={cart.isOpen} onOpenChange={(o) => o ? cart.openCart() : cart.closeCart()}>
        <SheetContent side="left" className="flex flex-col gap-0 p-0 w-full sm:max-w-md" dir="rtl">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-right">
              <ShoppingBag className="h-5 w-5 text-primary" /> سلة المشتريات ({cart.count})
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto opacity-30 mb-3" />
                <p>السلة فارغة</p>
              </div>
            ) : cart.items.map(item => (
              <div key={item.id} className="flex gap-3 p-3 rounded-lg border border-border bg-card">
                <div className="h-16 w-16 rounded-md bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : <Package className="h-6 w-6 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</p>
                  <p className="text-primary font-bold text-sm mt-1">{Number(item.price).toLocaleString()} ل.س</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 border border-border rounded-md">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => cart.setQty(item.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => cart.setQty(item.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => cart.remove(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cart.items.length > 0 && (
            <div className="border-t border-border p-4 space-y-3 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">الإجمالي (دون الشحن)</span>
                <span className="font-display font-bold text-lg text-primary">{cart.total.toLocaleString()} ل.س</span>
              </div>
              <Button className="w-full h-11" onClick={() => setCheckoutOpen(true)}>
                متابعة الشراء
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إتمام الطلب</DialogTitle>
            <DialogDescription>أدخل بيانات التوصيل لإرسال طلبك</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم الكامل</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="الاسم" />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <SyrianPhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>المحافظة</Label>
                <Select value={provinceId} onValueChange={(v) => { setProvinceId(v); setAreaId(""); }}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {provinces.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.province_ar || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المنطقة</Label>
                <Select value={areaId} onValueChange={setAreaId} disabled={areas.length === 0}>
                  <SelectTrigger><SelectValue placeholder={areas.length === 0 ? "—" : "اختر"} /></SelectTrigger>
                  <SelectContent>
                    {areas.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>العنوان التفصيلي</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="الشارع، المبنى، الطابق..." rows={2} />
            </div>
            <Button className="w-full h-11" onClick={submitOrder} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الطلب"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={!!success} onOpenChange={(o) => !o && setSuccess(null)}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <div className="text-center py-4 space-y-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-500">
              <Check className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-display font-bold">تم استلام طلبك! 🎉</h3>
              <p className="text-sm text-muted-foreground">سيتواصل معك التاجر قريباً</p>
            </div>
            {success && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="text-muted-foreground">أرقام الطلبات:</p>
                <p className="font-mono font-bold text-primary">{success.ids.join(" • ")}</p>
                <p className="pt-2 text-foreground font-bold">الإجمالي: {success.total.toLocaleString()} ل.س</p>
              </div>
            )}
            <Button className="w-full" onClick={() => setSuccess(null)}>تم</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}