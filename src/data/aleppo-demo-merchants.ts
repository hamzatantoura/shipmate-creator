// Shared demo merchant data for Aleppo operations
export interface DemoMerchant {
  id: string;
  name: string;
  neighborhood: string;
  lat: number;
  lng: number;
  packages: number;
  productValue: number;
  shippingFee: number;
}

export const ALEPPO_MERCHANTS: DemoMerchant[] = [
  { id: "demo-1", name: "أزياء السلطان", neighborhood: "الفرقان", lat: 36.1950, lng: 37.1480, packages: 5, productValue: 1250000, shippingFee: 35000 },
  { id: "demo-2", name: "إلكترونيات الشهباء", neighborhood: "الشهباء", lat: 36.2280, lng: 37.1200, packages: 8, productValue: 3200000, shippingFee: 55000 },
  { id: "demo-3", name: "مكتبة الفرقان", neighborhood: "الفرقان", lat: 36.1970, lng: 37.1520, packages: 3, productValue: 450000, shippingFee: 20000 },
  { id: "demo-4", name: "حلويات السعد", neighborhood: "الموكامبو", lat: 36.2100, lng: 37.1350, packages: 2, productValue: 680000, shippingFee: 18000 },
  { id: "demo-5", name: "عطور الشرق", neighborhood: "المحافظة", lat: 36.2150, lng: 37.1600, packages: 4, productValue: 920000, shippingFee: 28000 },
  { id: "demo-6", name: "موبايلات الجميلية", neighborhood: "الجميلية", lat: 36.2030, lng: 37.1550, packages: 7, productValue: 4500000, shippingFee: 48000 },
  { id: "demo-7", name: "أحذية الأناقة", neighborhood: "الجميلية", lat: 36.2045, lng: 37.1570, packages: 3, productValue: 750000, shippingFee: 22000 },
  { id: "demo-8", name: "سوبر ماركت النجمة", neighborhood: "السريان", lat: 36.2080, lng: 37.1480, packages: 6, productValue: 1800000, shippingFee: 42000 },
  { id: "demo-9", name: "مفروشات الديار", neighborhood: "حلب الجديدة", lat: 36.1880, lng: 37.1300, packages: 2, productValue: 5200000, shippingFee: 65000 },
  { id: "demo-10", name: "صيدلية الشفاء", neighborhood: "الحمدانية", lat: 36.1750, lng: 37.1100, packages: 4, productValue: 380000, shippingFee: 25000 },
  { id: "demo-11", name: "ملابس أطفال ليلى", neighborhood: "الحمدانية", lat: 36.1770, lng: 37.1130, packages: 5, productValue: 620000, shippingFee: 30000 },
  { id: "demo-12", name: "معرض الأمل للأجهزة", neighborhood: "الشهباء", lat: 36.2260, lng: 37.1230, packages: 1, productValue: 2100000, shippingFee: 15000 },
  { id: "demo-13", name: "بوتيك ورد", neighborhood: "المحافظة", lat: 36.2170, lng: 37.1580, packages: 6, productValue: 1450000, shippingFee: 38000 },
  { id: "demo-14", name: "مطعم بيت جدي", neighborhood: "الموكامبو", lat: 36.2115, lng: 37.1370, packages: 3, productValue: 520000, shippingFee: 20000 },
  { id: "demo-15", name: "قرطاسية النور", neighborhood: "السريان", lat: 36.2065, lng: 37.1500, packages: 2, productValue: 180000, shippingFee: 12000 },
];
