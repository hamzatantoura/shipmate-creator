import JsBarcode from "jsbarcode";

export interface LabelData {
  silaCode: string;
  createdAt: string;
  sender: { storeName: string; phone?: string | null; city?: string | null };
  receiver: { name: string; phone: string; city: string; district?: string | null; address: string };
  cod: number;
  notes?: string | null;
  courierName?: string | null;
  courierLogoUrl?: string | null;
  trackingNumber?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";

export function printShippingLabel(data: LabelData) {
  // Barcode encodes the real tracking number when available, else the Sila reference code
  const barcodeValue = (data.trackingNumber && data.trackingNumber.trim()) || data.silaCode;
  // Build barcode SVG off-DOM
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svgEl, barcodeValue, {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: false,
    margin: 0,
  });
  const barcodeSvg = new XMLSerializer().serializeToString(svgEl);

  const dateStr = new Date(data.createdAt).toLocaleDateString("ar-SY", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  const courierName = (data.courierName && data.courierName.trim()) || "—";
  const branchLabel =
    (data.branchName && data.branchName.trim()) || "توصيل للمنزل";
  const branchAddr = (data.branchAddress && data.branchAddress.trim()) || "";

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>بوليصة شحن — ${data.silaCode}</title>
<style>
  @page { size: A6; margin: 4mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Readex Pro', 'Tahoma', 'Arial', sans-serif; color: #0a0a0a; background: #fff; }
  .label { width: 100mm; min-height: 140mm; padding: 4mm; border: 1.5px solid #000; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .brand { font-weight: 800; font-size: 18pt; letter-spacing: 1px; }
  .brand small { font-weight: 500; font-size: 8pt; display: block; color: #555; }
  .meta { font-size: 8pt; text-align: left; color: #333; }
  hr { border: 0; border-top: 1px dashed #999; margin: 4px 0; }
  .section { padding: 4px 0; }
  .label-tag { font-size: 7.5pt; color: #666; margin-bottom: 1px; }
  .value { font-size: 11pt; font-weight: 600; line-height: 1.35; }
  .value.lg { font-size: 13pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
  .cod-box { margin-top: 4px; padding: 6px 8px; border: 2px solid #000; text-align: center; }
  .cod-box .label-tag { font-size: 9pt; color: #000; font-weight: 600; }
  .cod-box .amount { font-size: 18pt; font-weight: 900; }
  .barcode { text-align: center; padding: 6px 0 2px; }
  .barcode svg { width: 90%; height: 50px; }
  .barcode-text { font-family: 'Courier New', monospace; font-size: 11pt; font-weight: 700; letter-spacing: 2px; direction: ltr; }
  .footer { margin-top: 4px; font-size: 7pt; color: #666; text-align: center; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
  .no-print { position: fixed; top: 8px; left: 8px; padding: 6px 12px; background: #ff8c00; color: #fff; border: 0; border-radius: 6px; font-size: 12pt; cursor: pointer; }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">طباعة</button>
  <div class="label">
    <div class="row">
      <div class="brand" style="display:flex;align-items:center;gap:8px;">
        ${data.courierLogoUrl ? `<img src="${escapeHtml(data.courierLogoUrl)}" alt="" style="width:42px;height:42px;object-fit:contain;border-radius:6px;border:1px solid #ddd;background:#fff;" />` : ""}
        <div>
          <div style="font-weight:800;font-size:15pt;line-height:1.1;">${escapeHtml(courierName)}</div>
          <small style="font-weight:500;font-size:7.5pt;color:#666;">شركة الشحن المسؤولة</small>
        </div>
      </div>
      <div class="meta">
        <div>${dateStr}</div>
        <div>بوليصة شحن</div>
        <div style="font-family:'Courier New',monospace;font-size:7.5pt;color:#666;margin-top:2px;">${escapeHtml(data.silaCode)}</div>
      </div>
    </div>
    <hr />

    <div class="section">
      <div class="label-tag">المرسل (التاجر)</div>
      <div class="value">${escapeHtml(data.sender.storeName)}</div>
      <div class="value" style="font-size:9pt; font-weight:500; color:#444;">
        ${escapeHtml(data.sender.city || "")}${data.sender.phone ? " — " + escapeHtml(data.sender.phone) : ""}
      </div>
    </div>
    <hr />

    <div class="section">
      <div class="label-tag">المستلم</div>
      <div class="value lg">${escapeHtml(data.receiver.name)}</div>
      <div class="grid" style="margin-top:3px;">
        <div>
          <div class="label-tag">شركة الشحن</div>
          <div class="value" style="font-size:10pt;">${escapeHtml(courierName)}</div>
        </div>
        <div>
          <div class="label-tag">فرع الاستلام</div>
          <div class="value" style="font-size:10pt;">${escapeHtml(branchLabel)}${branchAddr ? ` <span style=\"font-weight:500;color:#555;font-size:8.5pt;\">— ${escapeHtml(branchAddr)}</span>` : ""}</div>
        </div>
      </div>
      <div class="grid" style="margin-top:3px;">
        <div>
          <div class="label-tag">الهاتف</div>
          <div class="value" dir="ltr" style="text-align:right;">${escapeHtml(data.receiver.phone)}</div>
        </div>
        <div>
          <div class="label-tag">المدينة / المنطقة</div>
          <div class="value">${escapeHtml(data.receiver.city)}${data.receiver.district ? " — " + escapeHtml(data.receiver.district) : ""}</div>
        </div>
      </div>
      <div style="margin-top:3px;">
        <div class="label-tag">العنوان التفصيلي</div>
        <div class="value" style="font-size:10pt;">${escapeHtml(data.receiver.address || "—")}</div>
      </div>
    </div>

    <div class="cod-box">
      <div class="label-tag">المبلغ المطلوب تحصيله (COD)</div>
      <div class="amount">${fmtSYP(data.cod)}</div>
    </div>

    <div class="barcode">
      ${barcodeSvg}
      <div class="barcode-text">${escapeHtml(barcodeValue)}</div>
    </div>

    ${data.notes ? `<hr /><div class="section"><div class="label-tag">ملاحظات</div><div class="value" style="font-size:9pt;">${escapeHtml(data.notes)}</div></div>` : ""}

    <div class="footer">Powered by <strong>صِلة Sila</strong> · sila-sy.com</div>
  </div>
  <script>
    window.addEventListener('load', function() { setTimeout(function(){ window.print(); }, 250); });
    window.addEventListener('afterprint', function() { /* keep tab so user can reprint */ });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=480,height=720");
  if (!w) {
    throw new Error("نافذة الطباعة محظورة من المتصفح. يرجى السماح بالنوافذ المنبثقة.");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
