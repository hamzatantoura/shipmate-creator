## 1. How the Barcode / Tracking workflow works today (read-only analysis)

### What the database generates
- Table `shipments` has a `tracking_number TEXT UNIQUE` column with a dedicated index (`idx_shipments_tracking_number`).
- DB function `public.generate_sila_code()` produces a strong, checksum-protected code in the format **`SL-XXXXXXXX-C`** — an 8-character body drawn from a 31-character ambiguity-free alphabet (no `0/1/I/L/O`) plus a 1-character mod-31 checksum. Mirror logic exists client-side in `src/features/shipments/lib/sila-code.ts`.
- The shipment-creation RPC (migration `20260510110605…`) calls `generate_sila_code()` and writes the result into `shipments.tracking_number` at the moment the merchant creates the shipment. So **every shipment already has a unique, printable barcode the instant it's created** — no extra admin step is required.

### Where that code is used
- **Printed waybill** (`src/features/shipments/lib/shipping-label.ts`) renders the barcode/QR from `shipment.tracking_number`, falling back to the first 12 chars of the shipment id only if `tracking_number` is null.
- **Public tracking page** + admin/merchant lookups go through RPCs `track_order_by_sila_code` and `lookup_shipment_by_code`, both of which match against `shipments.tracking_number` (case-insensitive, trimmed).
- **Standalone `BarcodeScanner` component** (`src/features/courier/components/BarcodeScanner.tsx`) calls `lookup_shipment_by_code` → resolves the real `tracking_number` correctly.

### The disconnect on the Courier "Quick Scanner" (المسح السريع)
The Quick Scanner bar inside `CourierOrders.tsx` does NOT use `tracking_number`. It uses a local helper:

```
silaCodeOf(id) = "SL-" + id.slice(0, 6).toUpperCase()   // first 6 hex chars of the order UUID
```

`handleScan` then matches the scanned text against this short form (or a prefix of the raw UUID). That means:
- The 6-char "SL-XXXXXX" shown in the courier table is **derived from the order UUID, not from `shipments.tracking_number`**.
- If a courier scans the **actual printed barcode** (the strong `SL-XXXXXXXX-C` from `tracking_number`), `handleScan` will almost always say "لم يتم العثور على طلب" because the strong code's body has no relationship to the order UUID's first 6 chars.

**Conclusion:** the backend already issues a real, unique barcode at shipment creation and the printed label uses it. The Quick Scanner is the only place still hard-coded to the legacy 6-char UUID slice; it needs to be aligned with `shipments.tracking_number` (and the aggregate query needs to include that field) before scans from printed labels will reliably succeed. No new "barcode generation feature" in Admin/Merchant is required.

*(No code is being changed in this step — this is explanation only, per your request.)*

## 2. Fix the modal close (X) overlapping the title

Root cause: `DialogContent` (shadcn) places `DialogPrimitive.Close` absolutely at `right-4 top-4`. In RTL, `DialogHeader` content (icon + title) runs to the right edge with no reserved space, so the X sits on top of the icon/title.

Change (one surgical edit in `src/components/ui/dialog.tsx`, applies app-wide):
- Add right-side padding to `DialogHeader` so titles never run under the close button:
  - `DialogHeader` className gets `pe-8` (logical padding-end, works in both LTR and RTL — pushes content away from the X corner regardless of direction).
- Keep the existing close-button position (`right-4 top-4`) but bump its hit area to `h-7 w-7` with `inline-flex items-center justify-center` so the icon is properly centered (currently it relies on default sizing and looks crooked in RTL).

No per-dialog changes needed; the courier "تعديل الوزن والقيمة", "تأكيد التسليم", "تراجع عن الحالة", and return-reason dialogs all use the same `DialogHeader`/`DialogContent` and will be fixed in one shot.

## 3. Fix mobile keyboard hiding the modal

Root cause: `DialogContent` is vertically centered with `top-[50%] translate-y-[-50%]` and capped at `max-h-[90dvh]`. When the virtual keyboard opens on Android/iOS the visual viewport shrinks but the modal stays centered against the layout viewport, so it slides under the keyboard.

Change (same file, `DialogContent`):
- Replace the unconditional centering with a responsive variant:
  - **Mobile (`< sm`):** anchor to the top — `top-4 translate-y-0`, `max-h-[calc(100dvh-2rem)]`, and keep `overflow-y-auto`. The modal opens at the top of the screen so the keyboard never covers it.
  - **`sm:` and up:** restore `sm:top-[50%] sm:translate-y-[-50%] sm:max-h-[90dvh]` so desktop/tablet layout is unchanged.
- Add `interactive-widget=resizes-content` to the existing `<meta name="viewport">` in `index.html` so Chrome on Android resizes the layout viewport when the keyboard opens (helps even non-modal inputs).

These two adjustments are non-behavioral and apply to every Dialog in the app — no per-screen tweaks needed.

## Files that will change (in the build step, not now)

```text
src/components/ui/dialog.tsx   // header padding, close-btn sizing, responsive top/center
index.html                     // viewport meta: add interactive-widget=resizes-content
```

## Out of scope for this plan

- Aligning the Quick Scanner to `shipments.tracking_number` (the real fix for section 1). I called this out as a known gap but did not include it in the edits, since you asked for explanation only on point 1. Say the word and I'll add it as a follow-up plan.
