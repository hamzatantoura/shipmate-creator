import JsBarcode from "jsbarcode";

export interface BulkLabelData {
  silaCode: string;
  createdAt: string;
  sender: { storeName: string; phone?: string | null; city?: string | null };
  receiver: { name: string; phone: string; city: string; district?: string | null; address: string };
  cod: number;
  notes?: string | null;
  courierName?: string | null;
  courierLogoUrl?: string | null;
  trackingNumber?: string | null;
}

export interface ManifestRow {
  silaCode: string;
  receiverName: string;
  address: string;
  phone: string;
  cod: number;
}

const fmtSYP = (n: number) =>
  new Intl.NumberFormat("ar-SY").format(Number(n) || 0) + " ل.س";

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function barcodeSvgFor(value: string): string {
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svgEl, value, {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: false,
    margin: 0,
  });
  return new XMLSerializer().serializeToString(svgEl);
}

/**
 * Print a sequence of A6 shipping labels (one per page).
 * Opens a new window so the host app's sidebar/navbar are physically
 * outside the print scope. The new window's own UI uses .no-print.
 */
export function printBulkLabels(labels: BulkLabelData[]) {
  if (!labels.length) throw new Error("لا توجد بوليصات للطباعة");

  const labelsHtml = labels
    .map((data) => {
      const barcodeValue =
        (data.trackingNumber && data.trackingNumber.trim()) || data.silaCode;
      const barcodeSvg = barcodeSvgFor(barcodeValue);
      const dateStr = new Date(data.createdAt).toLocaleDateString("ar-SY", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
      const courierName = (data.courierName && data.courierName.trim()) || "—";
      return `
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
            <div class="value" style="font-size:9pt;font-weight:500;color:#444;">
              ${escapeHtml(data.sender.city || "")}${data.sender.phone ? " — " + escapeHtml(data.sender.phone) : ""}
            </div>
          </div>
          <hr />
          <div class="section">
            <div class="label-tag">المستلم</div>
            <div class="value lg">${escapeHtml(data.receiver.name)}</div>
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
        </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>طباعة بوليصات مجمعة (${labels.length})</title>
<style>
  @page { size: A6; margin: 4mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Readex Pro','Tahoma','Arial',sans-serif; color:#0a0a0a; background:#fff; }
  .label { width: 100mm; min-height: 140mm; padding: 4mm; border: 1.5px solid #000; page-break-after: always; break-after: page; }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .row { display:flex; justify-content:space-between; align-items:center; gap:6px; }
  .meta { font-size:8pt; text-align:left; color:#333; }
  hr { border:0; border-top:1px dashed #999; margin:4px 0; }
  .section { padding:4px 0; }
  .label-tag { font-size:7.5pt; color:#666; margin-bottom:1px; }
  .value { font-size:11pt; font-weight:600; line-height:1.35; }
  .value.lg { font-size:13pt; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; }
  .cod-box { margin-top:4px; padding:6px 8px; border:2px solid #000; text-align:center; }
  .cod-box .label-tag { font-size:9pt; color:#000; font-weight:600; }
  .cod-box .amount { font-size:18pt; font-weight:900; }
  .barcode { text-align:center; padding:6px 0 2px; }
  .barcode svg { width:90%; height:50px; }
  .barcode-text { font-family:'Courier New',monospace; font-size:11pt; font-weight:700; letter-spacing:2px; direction:ltr; }
  .footer { margin-top:4px; font-size:7pt; color:#666; text-align:center; }
  .no-print { position:fixed; top:8px; left:8px; padding:8px 14px; background:#ff8c00; color:#fff; border:0; border-radius:6px; font-size:12pt; cursor:pointer; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.2); }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">طباعة ${labels.length} بوليصة</button>
  ${labelsHtml}
  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=520,height=760");
  if (!w) {
    throw new Error("نافذة الطباعة محظورة من المتصفح. يرجى السماح بالنوافذ المنبثقة.");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/**
 * Print a daily courier manifest (A4 table) — clean, signature column blank.
 */
export function printDailyManifest(rows: ManifestRow[], courierName: string) {
  if (!rows.length) throw new Error("لا توجد طلبات لإنشاء كشف الرحلة");

  const today = new Date().toLocaleDateString("ar-SY", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const totalCod = rows.reduce((s, r) => s + (Number(r.cod) || 0), 0);

  const tbody = rows
    .map(
      (r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="mono">${escapeHtml(r.silaCode)}</td>
        <td>${escapeHtml(r.receiverName)}</td>
        <td class="addr">${escapeHtml(r.address || "—")}</td>
        <td class="mono ltr">${escapeHtml(r.phone)}</td>
        <td class="num strong">${fmtSYP(r.cod)}</td>
        <td class="sig"></td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>كشف تسليم يومي — ${escapeHtml(today)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; font-family:'Readex Pro','Tahoma','Arial',sans-serif; color:#0a0a0a; background:#fff; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #000; padding-bottom:6mm; margin-bottom:6mm; }
  .header h1 { font-size:18pt; margin:0; font-weight:800; }
  .header .sub { font-size:10pt; color:#444; margin-top:2px; }
  .meta { text-align:left; font-size:10pt; line-height:1.5; }
  table { width:100%; border-collapse:collapse; font-size:10pt; }
  thead th { background:#111; color:#fff; padding:6px 5px; font-weight:700; font-size:9.5pt; border:1px solid #000; }
  tbody td { border:1px solid #999; padding:6px 5px; vertical-align:top; }
  td.num { text-align:center; tabular-nums:true; white-space:nowrap; }
  td.mono { font-family:'Courier New',monospace; font-size:9.5pt; }
  td.ltr { direction:ltr; text-align:right; }
  td.addr { font-size:9pt; color:#333; max-width:60mm; }
  td.strong { font-weight:700; }
  td.sig { width:30mm; height:14mm; }
  tbody tr:nth-child(even) td { background:#f7f7f7; }
  tfoot td { border:1px solid #000; padding:7px 5px; font-weight:800; background:#f0f0f0; }
  .footer { margin-top:8mm; display:flex; justify-content:space-between; font-size:9pt; color:#444; }
  .sign-block { border-top:1px solid #000; padding-top:3mm; min-width:55mm; text-align:center; }
  .no-print { position:fixed; top:8px; left:8px; padding:8px 14px; background:#ff8c00; color:#fff; border:0; border-radius:6px; font-size:12pt; cursor:pointer; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.2); }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">طباعة الكشف</button>
  <div class="header">
    <div>
      <h1>كشف تسليم يومي</h1>
      <div class="sub">${escapeHtml(courierName || "شركة الشحن")}</div>
    </div>
    <div class="meta">
      <div><strong>التاريخ:</strong> ${escapeHtml(today)}</div>
      <div><strong>عدد الطلبات:</strong> ${rows.length}</div>
      <div><strong>إجمالي التحصيل:</strong> ${fmtSYP(totalCod)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:8mm;">#</th>
        <th style="width:24mm;">رمز الطلب</th>
        <th>اسم المستلم</th>
        <th>العنوان</th>
        <th style="width:30mm;">الهاتف</th>
        <th style="width:28mm;">المبلغ (COD)</th>
        <th style="width:32mm;">توقيع المستلم</th>
      </tr>
    </thead>
    <tbody>${tbody}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:left;">الإجمالي</td>
        <td class="num">${fmtSYP(totalCod)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="sign-block">توقيع المندوب</div>
    <div class="sign-block">توقيع مسؤول الفرع</div>
  </div>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 350); });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) {
    throw new Error("نافذة الطباعة محظورة من المتصفح. يرجى السماح بالنوافذ المنبثقة.");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}