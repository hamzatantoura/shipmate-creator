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

interface MerchantShippingInfo {
  shipping_policy: string;
  free_shipping_threshold: number;
  whatsapp_number: string | null;
  phone: string | null;
  store_name: string | null;
  verification_status: string;
  is_active: boolean;
}

import { isValidSyrianPhone } from "@/shared/lib/syrian-phone";
import { SyrianPhoneInput } from "@/shared/components/inputs/SyrianPhoneInput";
import ProductReviews from "@/features/storefront/components/ProductReviews";
const validatePhone = isValidSyrianPhone;

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{
    orderId: string; receiverName: string; phone: string;
    city: string; address: string; total: number; productName: string;
  } | null>(null);
  const [shippingInfo, setShippingInfo] = useState<MerchantShippingInfo>({
    shipping_policy: "customer_pays", free_shipping_threshold: 0,
    whatsapp_number: null, phone: null, store_name: null,
    verification_status: "pending_verification", is_active: false,
  });
  const [merchantBlocked, setMerchantBlocked] = useState(false);

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

  // Fetch product + merchant info
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
        // Fetch merchant shipping + contact info + verification
        const { data: merchant } = await supabase
          .from("merchants")
          .select("shipping_policy, free_shipping_threshold, whatsapp_number, phone, store_name, verification_status, is_active")
          .eq("user_id", (prod as any).merchant_id)
          .single();
        if (merchant) {
          const m = merchant as any;
          setShippingInfo(m);
          if (m.verification_status !== "verified" || !m.is_active) {
            setMerchantBlocked(true);
          }
        }
      }
      setLoading(false);
    });
  }, [slug]);

  // Fetch geographic data
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
  const rawDeliveryFee = selectedDistrictObj ? Number(selectedDistrictObj.delivery_fee) : 0;

  const qty = parseInt(form.quantity) || 1;
  const productTotal = product ? product.price * qty : 0;
  const isShippingFreeForCustomer =
    shippingInfo.shipping_policy === "free_all" ||
    (shippingInfo.shipping_policy === "free_above" && productTotal >= shippingInfo.free_shipping_threshold);
  const customerDeliveryFee = isShippingFreeForCustomer ? 0 : rawDeliveryFee;

  // Filter sub-regions by selected district's province
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
    setPhoneError(val && !validatePhone(val) ? "رقم سوري غير صحيح. مثال: 0933123456" : "");
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!form.receiver_name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!validatePhone(form.phone_number)) { toast.error("رقم الهاتف غير صحيح"); return; }
    if (!selectedDistrict) { toast.error("الرجاء اختيار المحافظة"); return; }
    if (!selectedSubRegion && filteredSubRegions.length > 0) { toast.error("الرجاء اختيار الحي / المنطقة"); return; }

    // Validate delivery fee is not zero when shipping is on customer
    if (!isShippingFreeForCustomer && rawDeliveryFee <= 0) {
      toast.error("لا تتوفر تسعيرة شحن لهذه المنطقة حالياً، يرجى التواصل مع التاجر");
      return;
    }

    setSubmitting(true);
    const totalAmount = product.price * qty;

    const { data: rpcData, error } = await supabase.rpc("create_storefront_order" as any, {
      p_merchant_id: product.merchant_id,
      p_product_id: product.id,
      p_quantity: qty,
      p_district_id: selectedDistrict,
      p_receiver_name: form.receiver_name.trim(),
      p_phone_number: form.phone_number.trim(),
      p_detailed_address: form.detailed_address.trim() || "غير محدد",
      p_customer_lat: customerLat,
      p_customer_lng: customerLng,
    });
    setSubmitting(false);

    if (error) {
      console.error("Order insert error:", error);
      toast.error("فشل إرسال الطلب: " + (error.message || "خطأ غير معروف"));
      return;
    }

    const orderResult = rpcData as { order_id?: string; total_amount?: number; delivery_fee?: number } | null;
    const newOrderId = orderResult?.order_id;
    const serverTotal = Number(orderResult?.total_amount ?? totalAmount);
    const serverDelivery = Number(orderResult?.delivery_fee ?? customerDeliveryFee);

    setOrderDetails({
      orderId: newOrderId ? newOrderId.slice(0, 8).toUpperCase() : "—",
      receiverName: form.receiver_name.trim(),
      phone: form.phone_number.trim(),
      city: selectedDistrictObj?.province_ar || "",
      address: form.detailed_address.trim() || "غير محدد",
      total: serverTotal + serverDelivery,
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
    if (!orderDetails) return;
    // Use merchant's whatsapp_number first, then phone
    const rawPhone = shippingInfo.whatsapp_number || shippingInfo.phone;
    if (!rawPhone) {
      toast.error("رقم واتساب التاجر غير متوفر");
      return;
    }
    const phone = rawPhone.replace(/[\s-]/g, "").replace(/^0/, "963");
    const msg = `مرحباً، أود تأكيد طلبي رقم ${orderDetails.orderId} باسم ${orderDetails.receiverName}.\n\n📦 المنتج: ${orderDetails.productName}\n📍 المدينة: ${orderDetails.city}\n🏠 العنوان: ${orderDetails.address}\n💰 الإجمالي: ${orderDetails.total.toLocaleString()} ل.س`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">المنتج غير موجود</div>;
  if (merchantBlocked) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="max-w-md w-full border-border">
        <CardContent className="py-12 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-display font-bold text-foreground">المتجر غير متاح حالياً</h2>
          <p className="text-sm text-muted-foreground">هذا المتجر لم يكمل عملية التحقق بعد أو غير مفعّل. لا يمكن إتمام الطلب حالياً.</p>
        </CardContent>
      </Card>
    </div>
  );

  // ===== Success Page =====
  if (submitted) {
    const merchantWhatsApp = shippingInfo.whatsapp_number || shippingInfo.phone;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full border-primary/20 shadow-lg">
          <CardContent className="p-8 text-center space-y-5">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-500">
              <Check className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-bold text-foreground">تم استلام طلبك بنجاح! 🎉</h2>
              <p className="text-muted-foreground text-sm">سيتواصل معك التاجر قريباً لتأكيد الطلب وترتيب الشحن.</p>
            </div>
            {orderDetails && (
              <div className="text-sm bg-muted/50 rounded-xl p-4 space-y-2 text-right border border-border">
                <p className="text-muted-foreground">📦 {orderDetails.productName}</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">🆔 رقم الطلب</span>
                  <span className="font-mono font-bold text-primary text-base tracking-wider">{orderDetails.orderId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">💰 الإجمالي</span>
                  <span className="font-bold text-foreground text-base">{orderDetails.total.toLocaleString()} ل.س</span>
                </div>
              </div>
            )}
            {merchantWhatsApp && (
              <Button onClick={confirmViaWhatsApp} className="w-full gap-2 bg-[#25D366] hover:bg-[#1fb855] text-white h-12 text-base">
                <MessageCircle className="h-5 w-5" />
                تأكيد الطلب عبر واتساب
              </Button>
            )}
            {!merchantWhatsApp && (
              <p className="text-xs text-warning">رقم واتساب التاجر غير متوفر حالياً، سيتواصل معك التاجر مباشرةً.</p>
            )}
            {orderDetails && (
              <a href={`/track/${orderDetails.orderId}`} className="block">
                <Button variant="outline" className="w-full gap-2 h-11">
                  <Package className="h-4 w-4" />
                  تتبع حالة طلبك
                </Button>
              </a>
            )}
            <p className="text-xs text-muted-foreground pt-2">
              احتفظ برقم الطلب <span className="font-mono font-bold text-foreground">{orderDetails?.orderId}</span> لمتابعة شحنتك لاحقاً
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== Product + Order Form =====
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
              {product.description && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{product.description}</p>
              )}
              {/* Free shipping badge */}
              {shippingInfo.shipping_policy === "free_all" && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">🚚 شحن مجاني</span>
              )}
              {shippingInfo.shipping_policy === "free_above" && shippingInfo.free_shipping_threshold > 0 && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  🚚 شحن مجاني للطلبات فوق {Number(shippingInfo.free_shipping_threshold).toLocaleString()} ل.س
                </span>
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
                    <SyrianPhoneInput
                      value={form.phone_number}
                      onChange={handlePhoneChange}
                      required
                      className={phoneError ? "border-destructive rounded-md" : ""}
                    />
                    {phoneError && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {phoneError}
                      </p>
                    )}
                  </div>

                  {/* Province selector - NO price shown */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> المحافظة <span className="text-destructive">*</span></Label>
                    <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                      <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                      <SelectContent>
                        {districts.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.province_ar} {d.area_ar ? `— ${d.area_ar}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sub-region selector */}
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

                  {/* Order Summary */}
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">سعر المنتج</span>
                      <span className="font-display font-bold text-foreground">
                        {productTotal.toLocaleString()} ل.س
                      </span>
                    </div>
                    {/* Show shipping fee ONLY in summary, not in dropdown */}
                    {selectedDistrict && !isShippingFreeForCustomer && rawDeliveryFee > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">رسوم التوصيل</span>
                        <span className="font-display font-bold text-foreground">{customerDeliveryFee.toLocaleString()} ل.س</span>
                      </div>
                    )}
                    {isShippingFreeForCustomer && selectedDistrict && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">رسوم التوصيل</span>
                        <span className="font-display font-bold text-primary">مجاني ✓</span>
                      </div>
                    )}
                    {selectedDistrict && !isShippingFreeForCustomer && rawDeliveryFee <= 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-warning">⚠️ لا تتوفر تسعيرة شحن لهذه المنطقة</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-sm font-semibold text-foreground">الإجمالي</span>
                      <span className="font-display font-bold text-primary text-lg">
                        {(productTotal + customerDeliveryFee).toLocaleString()} ل.س
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
        <ProductReviews productId={product.id} />
      </main>
    </div>
  );
}
