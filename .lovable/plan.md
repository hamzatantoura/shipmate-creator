
## المشكلة الفعلية

بعد فحص آخر migrations والكود، حددت **3 أعطال جوهرية** تمنع القفل من العمل وتسبب الفصل بين واجهة التاجر وحركة المندوب:

### 1) القفل الأول (first-print-lock) شبه مستحيل التحقق

في `enforce_order_lock()` لكي يُسمح للتاجر بأول قفل، يجب أن **يكون التحديث متضمناً في الوقت نفسه**:
- `label_printed_at` ينتقل من NULL → قيمة
- `shipment_id` ينتقل من NULL → قيمة  
- `status` يصبح `'processing'`

لكن في الواقع `lock_order_after_label_print` RPC تعمل بـ `SECURITY DEFINER` وتُحدّث الجدول من داخل الدالة — وهنا التريغر يستدعي `auth.uid()` ويرى التاجر، فيدخل في فرع `is_first_print_lock`. لكن إذا كان `shipment_id` **مرتبطاً مسبقاً** بالطلب (وهو الوضع الطبيعي عند إنشاء الشحنة قبل الطباعة)، فإن `OLD.shipment_id IS NOT NULL` يجعل `is_already_locked = true` فوراً، فيسقط في فرع المنع ويرفض حتى تغيير `label_printed_at`. → **القفل يفشل بـ "ORDER_LOCKED_AFTER_LABEL_PRINT"**.

### 2) `sync_shipment_status_to_order` يضرب جدار `enforce_order_lock`

عند مسح المندوب للباركود، الـRPC تغيّر حالة الشحنة → التريغر `trg_sync_shipment_to_order` يُحدّث `orders.status`. لكنه يعمل بـ`SECURITY DEFINER` فيُنفَّذ بصلاحيات المالك (postgres). داخله، التريغر `enforce_order_lock` يستدعي `auth.uid()` الذي **يبقى هو المندوب (vendor)**، لذا يمر. لكن إذا كان `auth.uid()` فارغاً (تحديث من جوب) أو كان السياق تاجراً، فإن تغيير الحالة من `processing` إلى `shipped` يُرفض بسبب الشرط:
```
NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('cancelled')
```
→ **التحديثات الواردة من الشحنة تتعطل صامتاً** والواجهة لا تتحدث.

### 3) `prevent_merchant_status_spoof` يضرب التريغر نفسه أيضاً

نفس المشكلة: حين يتدفق التحديث القادم من جدول الشحنات (عبر `sync_shipment_status_to_order`) إلى جدول الطلبات، تُستدعى `prevent_merchant_status_spoof` التي تحظر `'shipped'` و`'delivered'` و`'returned'` إذا لم يكن المستدعي admin/vendor — وفي بعض السياقات (jobs خلفية، cron، وظائف مرتبطة) يكون `auth.uid()` تاجراً أو فارغاً → **رمي خطأ صامت**.

### 4) واجهة التاجر لا تحدّث الكاش بعد القفل بسكل سريع

`MerchantOrdersPage` يضع تحديثاً متفائلاً ولكن لا يُعيد جلب الطلب من نفس استعلام القفل، لذا تبقى أزرار التعديل/الإلغاء ظاهرة لمدة ثوانٍ، ويعتقد المستخدم أن القفل لم يطبق.

---

## خطة الإصلاح

### أ) إصلاح تريغر `enforce_order_lock`

إعادة تعريف منطق **"القفل الأول"** ليعتمد فقط على انتقال `label_printed_at` من NULL → قيمة، **مع السماح ببقاء `shipment_id` موجوداً مسبقاً** (وهو الطبيعي):

```
is_first_print_lock := OLD.label_printed_at IS NULL
                    AND NEW.label_printed_at IS NOT NULL
                    AND (OLD.shipment_id IS NULL OR OLD.shipment_id = NEW.shipment_id);
```

ثم:
- في فرع القفل الأول: نسمح بالتحديث ونضع `status='processing'` تلقائياً.
- في فرع "مقفول مسبقاً": نتجاهل التحديثات القادمة من **التريغرات الأخرى** (أي حين `current_setting('app.from_shipment_sync', true) = '1'`).

### ب) إصلاح `sync_shipment_status_to_order`

داخل الدالة، نضع علامة جلسة قبل التحديث ونحذفها بعده:
```
PERFORM set_config('app.from_shipment_sync', '1', true);
UPDATE public.orders SET ... ;
PERFORM set_config('app.from_shipment_sync', '', true);
```
ونعدّل `enforce_order_lock` و`prevent_merchant_status_spoof` ليتجاهلا التحديث إذا كانت العلامة مفعلة (لأنه قادم من النظام، لا من التاجر).

### ج) `prevent_merchant_status_spoof`

نسمح أيضاً بتحوّل الحالة إلى `'cancelled'` للتاجر إذا لم يكن مقفولاً، ونسمح بأي تحوّل صادر من `app.from_shipment_sync='1'` بدون قيود.

### د) ضمان وجود `order_id` على الشحنة

`sync_shipment_status_to_order` تستخدم `WHERE shipment_id = NEW.id OR id = NEW.order_id`. إذا أنشأ التاجر شحنة قبل ربطها (order_id NULL)، المزامنة تفشل. سنضيف:
- تريغر `BEFORE INSERT/UPDATE` على `shipments` يضمن أن إذا تم إنشاء/تحديث `shipments.order_id`، يتم تلقائياً تحديث `orders.shipment_id` بالقيمة المقابلة.
- في `BarcodeScanner.updateStatus`، نُبقي على المزامنة الاحتياطية الحالية (orders update) كحماية.

### هـ) إصلاحات الواجهة

في `MerchantOrdersPage.tsx`:
- بعد نجاح `lock_order_after_label_print`، نُجبر `queryClient.invalidateQueries(['merchant-orders'])` بدل تحديث متفائل غير موثوق.
- نُضيف اشتراك Realtime على جدول `orders` المُفلتر بـ `merchant_id=eq.{userId}` لاستقبال تحديث `status` و`shipment_id` و`label_printed_at` الفورية، ونحدّث الكاش جراحياً عبر `setQueryData`.

في `CourierOrders.tsx`: التأكد من أن الـ realtime patch يحدّث `status` على الطلبات أيضاً (موجود — نتحقق فقط).

---

## الملفات التي ستتغير

1. **migration جديد** (`fix_order_locking_and_sync.sql`):
   - إعادة كتابة `enforce_order_lock()`
   - إعادة كتابة `prevent_merchant_status_spoof()`
   - إعادة كتابة `sync_shipment_status_to_order()` مع علم الجلسة
   - تريغر جديد `auto_link_shipment_to_order` على جدول `shipments`

2. **`src/pages/MerchantOrdersPage.tsx`**:
   - استبدال التحديث المتفائل بـ `invalidateQueries` بعد القفل
   - إضافة اشتراك Realtime على `orders`

3. **`src/components/vendor/BarcodeScanner.tsx`**:
   - تبسيط `updateStatus`: لا حاجة لتحديث `orders` يدوياً بعد إصلاح المزامنة (نتركها كـfallback صامت).

4. **`src/lib/order-locking.ts`**: لا تغيير (المنطق صحيح).

---

## نتيجة متوقعة

- التاجر يضغط "طباعة البوليصة" → القفل ينجح فوراً، أزرار التعديل/الإلغاء تختفي خلال أقل من ثانية.
- المندوب يمسح الباركود → حالة الشحنة تتغير → تلقائياً حالة الطلب في واجهة التاجر تتحدث Realtime دون تحديث يدوي.
- لا يمكن للتاجر تغيير أي حقل بعد طباعة البوليصة (محمي على مستوى DB، ليس فقط UI).
