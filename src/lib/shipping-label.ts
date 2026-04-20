import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

interface ShipmentData {
  id: string;
  tracking_number: string | null;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  cod_amount: number;
  merchant_id: string;
  status: string;
  notes?: string | null;
  district_name?: string | null;
  order_id?: string | null;
}

interface MerchantInfo {
  store_name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
}

function generateBarcodeDataUrl(text: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, text, {
      format: "CODE128",
      width: 2,
      height: 50,
      displayValue: false,
      margin: 0,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

export async function generateShippingLabel(shipment: ShipmentData, format: "a6" | "a4" = "a6") {
  const trackingNum = shipment.tracking_number || shipment.id.slice(0, 12).toUpperCase();

  // Fetch merchant info
  let merchant: MerchantInfo = { store_name: "—", contact_person: null, phone: null, city: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_name, contact_person, phone, city")
    .eq("user_id", shipment.merchant_id)
    .single();
  if (profile) {
    merchant = {
      store_name: profile.store_name || "—",
      contact_person: profile.contact_person,
      phone: profile.phone,
      city: profile.city,
    };
  }

  // Resolve district/area name from the linked order if not passed in
  let districtName: string | null = shipment.district_name ?? null;
  if (!districtName) {
    const orderId = shipment.order_id;
    const { data: order } = orderId
      ? await supabase.from("orders").select("district_id").eq("id", orderId).maybeSingle()
      : await supabase.from("orders").select("district_id").eq("shipment_id", shipment.id).maybeSingle();
    if (order?.district_id) {
      const { data: d } = await supabase
        .from("districts")
        .select("name, parent_id")
        .eq("id", order.district_id)
        .maybeSingle();
      if (d?.parent_id) districtName = d.name; // only show area, not province
    }
  }

  // Generate QR & Barcode
  const qrDataUrl = await QRCode.toDataURL(trackingNum, { width: 100, margin: 1 });
  const barcodeDataUrl = generateBarcodeDataUrl(trackingNum);

  const pageSize = format === "a6"
    ? "size: 105mm 148mm;"
    : "size: 210mm 297mm;";

  const scale = format === "a4" ? 1.8 : 1;
  const padding = format === "a4" ? "15mm 20mm" : "5mm";

  const w = window.open("", "_blank", "width=500,height=700");
  if (!w) return;

  w.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>بوليصة شحن — ${trackingNum}</title>
  <style>
    @page { ${pageSize} margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      padding: ${padding};
      background: #fff;
      color: #000;
    }
    .label {
      border: 2.5px solid #000;
      display: flex;
      flex-direction: column;
      height: 100%;
      transform-origin: top right;
      ${format === "a4" ? "max-width: 170mm; margin: 0 auto;" : ""}
    }

    /* Header */
    .header {
      background: #111;
      color: #fff;
      padding: ${8 * scale}px ${12 * scale}px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: ${18 * scale}px; font-weight: 800; letter-spacing: 1px; }
    .header .sub { font-size: ${9 * scale}px; opacity: 0.7; }

    /* Tracking */
    .tracking {
      background: #f5f5f5;
      padding: ${8 * scale}px;
      text-align: center;
      border-bottom: 2px dashed #000;
    }
    .tracking .lbl { font-size: ${8 * scale}px; color: #666; margin-bottom: 2px; }
    .tracking .num { font-size: ${20 * scale}px; font-weight: 900; letter-spacing: 3px; font-family: monospace; }

    /* Sections */
    .section {
      padding: ${8 * scale}px ${10 * scale}px;
      border-bottom: 1.5px solid #ddd;
    }
    .section-title {
      font-size: ${9 * scale}px;
      font-weight: 700;
      color: #666;
      margin-bottom: ${4 * scale}px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      padding: ${3 * scale}px 0;
    }
    .info-row .lbl {
      font-size: ${9 * scale}px;
      color: #888;
      min-width: ${55 * scale}px;
      font-weight: 600;
    }
    .info-row .val {
      font-size: ${11 * scale}px;
      font-weight: 700;
    }

    /* COD Box */
    .cod-box {
      background: #111;
      color: #fff;
      margin: ${6 * scale}px ${10 * scale}px;
      padding: ${10 * scale}px ${12 * scale}px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      border-radius: 4px;
    }
    .cod-box .lbl { font-size: ${11 * scale}px; }
    .cod-box .amount { font-size: ${18 * scale}px; font-family: monospace; letter-spacing: 1px; }

    /* Codes section */
    .codes {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${6 * scale}px ${10 * scale}px;
      border-top: 2px dashed #000;
      flex: 0;
    }
    .codes .qr img { width: ${70 * scale}px; height: ${70 * scale}px; }
    .codes .barcode { flex: 1; text-align: center; }
    .codes .barcode img { height: ${40 * scale}px; max-width: 100%; }
    .codes .barcode-text { font-size: ${8 * scale}px; font-family: monospace; color: #333; display: block; margin-top: 2px; }

    /* Footer */
    .footer {
      text-align: center;
      font-size: ${7 * scale}px;
      color: #aaa;
      padding: ${3 * scale}px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div>
        <h1>Sila — صلة</h1>
        <span class="sub">خدمات الشحن والتوصيل</span>
      </div>
    </div>

    <div class="tracking">
      <p class="lbl">رقم التتبع — TRACKING NUMBER</p>
      <p class="num">${trackingNum}</p>
    </div>

    <!-- Merchant Info -->
    <div class="section">
      <p class="section-title">📦 معلومات المرسل</p>
      <div class="info-row"><span class="lbl">المتجر</span><span class="val">${merchant.store_name}</span></div>
      ${merchant.contact_person ? `<div class="info-row"><span class="lbl">جهة الاتصال</span><span class="val">${merchant.contact_person}</span></div>` : ""}
      ${merchant.phone ? `<div class="info-row"><span class="lbl">الهاتف</span><span class="val" style="direction:ltr;text-align:right">${merchant.phone}</span></div>` : ""}
      ${merchant.city ? `<div class="info-row"><span class="lbl">المدينة</span><span class="val">${merchant.city}</span></div>` : ""}
    </div>

    <!-- Customer Info -->
    <div class="section">
      <p class="section-title">🏠 معلومات المستلم</p>
      <div class="info-row"><span class="lbl">الاسم</span><span class="val">${shipment.receiver_name}</span></div>
      <div class="info-row"><span class="lbl">الهاتف</span><span class="val" style="direction:ltr;text-align:right">${shipment.phone_number}</span></div>
      <div class="info-row"><span class="lbl">المدينة</span><span class="val">${CITY_AR[shipment.city] || shipment.city}</span></div>
      <div class="info-row"><span class="lbl">العنوان</span><span class="val">${shipment.detailed_address}</span></div>
    </div>

    <!-- COD -->
    <div class="cod-box">
      <span class="lbl">💰 الدفع عند الاستلام — COD</span>
      <span class="amount">${Number(shipment.cod_amount).toLocaleString()} ل.س</span>
    </div>

    ${shipment.notes ? `
    <!-- Notes -->
    <div class="section" style="background: #fffbe6; border-bottom: 1.5px solid #f5c518;">
      <p class="section-title">📝 ملاحظات</p>
      <p style="font-size: ${11 * scale}px; font-weight: 600; color: #333;">${shipment.notes}</p>
    </div>
    ` : ""}

    <!-- Barcodes -->
    <div class="codes">
      <div class="qr">
        <img src="${qrDataUrl}" alt="QR Code" />
      </div>
      <div class="barcode">
        ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Barcode" />` : ""}
        <span class="barcode-text">${trackingNum}</span>
      </div>
    </div>

    <div class="footer">Sila © ${new Date().getFullYear()} — بوليصة شحن مولّدة تلقائياً</div>
  </div>

  <script>
    setTimeout(function() { window.print(); }, 300);
  </script>
</body>
</html>`);
  w.document.close();
}
