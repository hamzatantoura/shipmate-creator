import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Package, Loader2, MapPin, Share2, Check, AlertCircle, MessageCircle } from "lucide-react";

interface Product {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; merchant_id: string; weight_kg: number; slug: string | null;
}

interface ProductImage {
  id: string; image_url: string; sort_order: number;
}

interface District {
  id: string; province: string; province_ar: string; area: string | null; area_ar: string | null; delivery_fee: number;
}

interface Province {
  id: string; name: string; name_ar: string;
}

interface SubRegion {
  id: string; name: string; name_ar: string; province_id: string;
}

const SYRIA_PHONE_REGEX = /^(\+?963|0)?9\d{8}$/;
function validatePhone(phone: string): boolean {
  return SYRIA_PHONE_REGEX.test(phone.replace(/[\s-]/g, ""));
}

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{ orderId: string; receiverName: string; phone: string; city: string; address: string; total: number; productName: string } | null>(null);
  const [merchantPhone, setMerchantPhone] = useState<string | null>(null);

  const [districts, setDistricts] = useState<District[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [filteredSubRegions, setFilteredSubRegions] = useState<SubRegion[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSubRegion, setSelectedSubRegion] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [form, setForm] = useState({
    receiver_name: "", phone_number: "", detailed_address: "", quantity: "1",
  });

  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase.from("products").select("*").eq("slug", slug).single().then(async ({ data, error }) => {
      let prod = data;
      if (error || !data) {
        const res = await supabase.from("products").select("*").eq("id", slug).single();
        prod = res.data;
      }
      if (prod) {
        setProduct(prod as any);
        setMainImage((prod as any).image_url);
        const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", (prod as any).id).order("sort_order");
        if (imgs) setImages(imgs as ProductImage[]);
        // Fetch merchant phone for WhatsApp
        const { data: profile } = await supabase.from("profiles").select("phone").eq("user_id", (prod as any).merchant_id).single();
        if (profile?.phone) setMerchantPhone(profile.phone);
      }
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    Promise.all([
      supabase.from("districts").select("*").eq("is_active", true).order("province_ar"),
      supabase.from("provinces").select("*").order("name_ar"),
      supabase.from("sub_regions").select("*").order("name_ar"),
    ]).then(([distRes, provRes, subRes]) => {
      if (distRes.data) setDistricts(distRes.data as any);
      if (provRes.data) setProvinces(provRes.data as any);
      if (subRes.data) setSubRegions(subRes.data as any);
    });
  }, []);

  const selectedDistrictObj = districts.find(d => d.id === selectedDistrict);
  const deliveryFee = selectedDistrictObj ? Number(selectedDistrictObj.delivery_fee) : 0;

  useEffect(() => {
    if (selectedDistrictObj && provinces.length > 0 && subRegions.length > 0) {
      const province = provinces.find(p => p.name === selectedDistrictObj.province || p.name_ar === selectedDistrictObj.province_ar);
      if (province) {
        setFilteredSubRegions(subRegions.filter(sr => sr.province_id === province.id));
      } else {
        setFilteredSubRegions([]);
      }
    } else {
      setFilteredSubRegions([]);
    }
    setSelectedSubRegion("");
  }, [selectedDistrict, provinces, subRegions]);

  const handlePhoneChange = (val: string) => {
    setForm({ ...form, phone_number: val });
    setPhoneError(val && !validatePhone(val) ? "صيغة الرقم غير صحيحة. مثال: 0912345678" : "");
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!form.receiver_name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!validatePhone(form.phone_number)) { toast.error("رقم الهاتف غير صحيح"); return; }
    if (!selectedDistrict) { toast.error("الرجاء اختيار المحافظة"); return; }
    if (!selectedSubRegion) { toast.error("الرجاء اختيار الحي / المنطقة"); return; }

    setSubmitting(true);
    const qty = parseInt(form.quantity) || 1;
    const totalAmount = product.price * qty;

    const { data: orderData, error } = await supabase.from("orders").insert({
      merchant_id: product.merchant_id,
      product_id: product.id,
      quantity: qty,
      total_amount: totalAmount,
      delivery_fee: deliveryFee,
      platform_fee: totalAmount * 0.05,
      net_amount: totalAmount - deliveryFee - (totalAmount * 0.05),
      receiver_name: form.receiver_name.trim(),
      phone_number: form.phone_number.trim(),
      city: selectedDistrictObj?.province_ar || "",
      detailed_address: form.detailed_address.trim() || "غير محدد",
      district_id: selectedDistrict,
      customer_lat: customerLat,
      customer_lng: customerLng,
    } as any).select("id").single();
    setSubmitting(false);
    if (error) { toast.error("فشل إرسال الطلب"); return; }

    setOrderDetails({
      orderId: (orderData as any)?.id?.slice(0, 8)?.toUpperCase() || "—",
      receiverName: form.receiver_name.trim(),
      phone: form.phone_number.trim(),
      city: selectedDistrictObj?.province_ar || "",
      address: form.detailed_address.trim() || "غير محدد",
      total: totalAmount + deliveryFee,
      productName: product.name,
    });
    setSubmitted(true);
    toast.success("تم إرسال طلبك بنجاح!");
  };

  const shareWhatsApp = () => {
    if (!product) return;
    const url = window.location.href;
    const text = `${product.name}\nالسعر: ${Number(product.price).toLocaleString()} ل.س\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const confirmViaWhatsApp = () => {
    if (!orderDetails || !merchantPhone) return;
    const phone = merchantPhone.replace(/[\s-]/g, "").replace(/^0/, "963");
    const msg = `✅ تأكيد طلب جديد\n\n📦 المنتج: ${orderDetails.productName}\n🆔 رقم الطلب: ${orderDetails.orderId}\n👤 الاسم: ${orderDetails.receiverName}\n📱 الهاتف: ${orderDetails.phone}\n📍 المدينة: ${orderDetails.city}\n🏠 العنوان: ${orderDetails.address}\n💰 الإجمالي: ${orderDetails.total.toLocaleString()} ل.س`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
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
            {orderDetails && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1 text-right">
                <p>📦 {orderDetails.productName}</p>
                <p>🆔 رقم الطلب: <span className="font-mono">{orderDetails.orderId}</span></p>
                <p>💰 الإجمالي: <span className="font-bold text-foreground">{orderDetails.total.toLocaleString()} ل.س</span></p>
              </div>
            )}
            {merchantPhone && (
              <Button onClick={confirmViaWhatsApp} className="w-full gap-2 bg-[#25D366] hover:bg-[#1fb855] text-white">
                <MessageCircle className="h-5 w-5" />
                تأكيد الطلب عبر واتساب
              </Button>
            )}
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

          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">{product.name}</h1>
              <p className="text-2xl font-display font-bold text-primary">{Number(product.price).toLocaleString()} ل.س</p>
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
                    <Label>الاسم الكامل <span className="text-destructive">*</span></Label>
                    <Input value={form.receiver_name} onChange={e => setForm({...form, receiver_name: e.target.value})} required />
                  </div>

                  <div className="space-y-1.5">
                    <Label>رقم الهاتف <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.phone_number}
                      onChange={e => handlePhoneChange(e.target.value)}
                      required dir="ltr" placeholder="0912345678"
                      className={phoneError ? "border-destructive" : ""}
                    />
                    {phoneError && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {phoneError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span></Label>
                    <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                      <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                      <SelectContent>
                        {districts.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.province_ar} {d.area_ar ? `— ${d.area_ar}` : ""} ({Number(d.delivery_fee).toLocaleString()} ل.س)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> الحي / المنطقة <span className="text-destructive">*</span></Label>
                    <Select value={selectedSubRegion} onValueChange={setSelectedSubRegion} disabled={filteredSubRegions.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedDistrict ? (filteredSubRegions.length > 0 ? "اختر الحي" : "لا توجد أحياء لهذه المحافظة") : "اختر المحافظة أولاً"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubRegions.map(sr => (
                          <SelectItem key={sr.id} value={sr.id}>{sr.name_ar}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>العنوان التفصيلي</Label>
                    <Textarea value={form.detailed_address} onChange={e => setForm({...form, detailed_address: e.target.value})} rows={2} placeholder="الشارع، البناء، الطابق..." />
                  </div>

                  <div className="space-y-1.5">
                    <Label>الكمية</Label>
                    <Input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">سعر المنتج</span>
                      <span className="font-display font-bold text-foreground">
                        {(product.price * (parseInt(form.quantity) || 1)).toLocaleString()} ل.س
                      </span>
                    </div>
                    {selectedDistrict && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">رسوم التوصيل</span>
                        <span className="font-display font-bold text-foreground">{deliveryFee.toLocaleString()} ل.س</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-sm font-semibold text-foreground">الإجمالي</span>
                      <span className="font-display font-bold text-primary text-lg">
                        {((product.price * (parseInt(form.quantity) || 1)) + deliveryFee).toLocaleString()} ل.س
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">الدفع عند الاستلام (COD) فقط</p>
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