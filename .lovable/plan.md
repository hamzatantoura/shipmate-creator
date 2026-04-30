# تشخيص دقيق

نعم — لقد قمت فعلاً بتسجيل الدخول إلى حساب شركة "مسارات" وأرسلت الطلب إليها. تأكدت من قاعدة البيانات:

| الحقل | القيمة |
|---|---|
| الطلب `SL-EFA60B` | موجود ✅ |
| `courier_id` | `4e2a25c4…` (= **مسارات**) ✅ |
| `status` | `new` ✅ |
| `shipment_id` | **NULL** ❌ ← أصل المشكلة |

ثم تحققت من جميع طلبات مسارات: **9 طلبات، كلها `shipment_id = NULL`** — وليس طلباً واحداً فقط.

## السبب الحقيقي

في `MerchantOrdersPage.tsx`، عند إنشاء طلب جديد، الكود يُدخل صفّاً في جدول `orders` فقط، **ولا يُنشئ صفّاً مقابلاً في جدول `shipments` أبداً**. وبما أن لا يوجد أي تريغر (DB Trigger) على جدول `orders` يقوم بذلك تلقائياً، يبقى `shipment_id` فارغاً للأبد.

النتيجة على بوابة شركة الشحن:
- **مسح الباركود** → يبحث عن `shipments.tracking_number` → لا يجد شيئاً → "لم يتم إنشاء سجل شحنة بعد" ❌
- **عرض الطلبات** → الـ join مع `shipments` يرجع NULL، فلا تظهر بيانات الشحنة (cod_amount, tracking, weight…) ❌
- **تحديث الحالة** → الكود يحاول `UPDATE shipments WHERE id = NULL` → لا يحدث شيء ❌

أما الرسالة الأخرى ("لم يتم العثور على ملف شركة الشحن") فتعني أنك دخلت بحساب آخر غير `hamza` (الـ vendor الفعلي لمسارات). لكنها مشكلة منفصلة لا علاقة لها بموضوعنا.

---

# الحل الجذري المقترح

أُنشئ **Database Trigger** على جدول `orders` يقوم تلقائياً بإنشاء `shipment` مرافق لكل طلب جديد، ويربطه بـ `orders.shipment_id`. هذا الحل يعمل لكل الطلبات المستقبلية بدون أي تعديل في الواجهة.

## خطوات التنفيذ

### 1) Migration: دالة + تريغر (AFTER INSERT)
ينشئ صفّاً في `shipments` مع:
- `merchant_id`, `courier_id` ← من الطلب
- `cod_amount` ← `final_sale_price` أو `total_amount`
- `collection_fee` ← `delivery_fee`
- `receiver_name`, `phone_number`, `city`, `detailed_address` ← من الطلب
- `tracking_number` ← `'SL-' || upper(substr(replace(order_id::text, '-', ''), 1, 6))` (نفس صيغة باركود الواجهة)
- `status = 'pending'`, `order_id = NEW.id`

ثم `UPDATE orders SET shipment_id = <new_id> WHERE id = NEW.id`.

### 2) Backfill للطلبات الـ 9 الموجودة
نفس المنطق على كل الطلبات الحالية بـ `shipment_id IS NULL` — لكي يعمل طلب SL-EFA60B والطلبات السابقة فوراً.

### 3) (اختياري لكن موصى به) Trigger ثانٍ على UPDATE
عندما يُحدِّث المتجر `final_sale_price` أو `delivery_fee`، نُحدِّث `shipments.cod_amount` و `collection_fee` تلقائياً للحفاظ على التزامن.

### تفاصيل تقنية مختصرة
```sql
create or replace function public.create_shipment_for_order()
returns trigger language plpgsql security definer
set search_path = public as $$
declare new_shipment_id uuid;
begin
  insert into public.shipments (
    order_id, merchant_id, courier_id,
    receiver_name, phone_number, city, detailed_address,
    cod_amount, collection_fee, tracking_number, status
  ) values (
    new.id, new.merchant_id, new.courier_id,
    new.receiver_name, new.phone_number, new.city::city, new.detailed_address,
    coalesce(new.final_sale_price, new.total_amount, 0),
    coalesce(new.delivery_fee, 0),
    'SL-' || upper(substr(replace(new.id::text,'-',''),1,6)),
    'pending'
  ) returning id into new_shipment_id;

  update public.orders set shipment_id = new_shipment_id where id = new.id;
  return new;
end; $$;

create trigger orders_create_shipment_aft_ins
after insert on public.orders
for each row execute function public.create_shipment_for_order();
```
> ملاحظة: سأتحقق من نوع `city` الحقيقي (USER-DEFINED enum) قبل التنفيذ، وأضيف cast مناسب أو fallback آمن لو المدينة لا تطابق قيمة في الـ enum.

---

# للموافقة

هل أنفّذ الآن:
1. ✅ التريغر الجذري على `INSERT`
2. ✅ Backfill للطلبات الـ 9 الحالية (سيظهر SL-EFA60B فوراً في بوابة مسارات بكامل بياناته)
3. ◻ التريغر الثاني على `UPDATE` للتزامن (اختياري — قل لي إن أردته)
