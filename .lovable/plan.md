# إصلاح مشكلة إعادة ضبط التبويبات

## المشكلة
في لوحة الأدمن (`/admin`)، كل مرة تنتقل فيها بين التبويبات (شركات الشحن، الفروع، المناطق، التجار...) يعيدك النظام تلقائياً إلى تبويب **"إدارة الشحنات"**.

## السبب التقني
المكون يستخدم `<Tabs defaultValue="shipments">` بدون التحكم في الحالة (uncontrolled). 

عند كل إعادة رندر للصفحة — وهو ما يحدث باستمرار بسبب:
- تحديث البيانات (`fetchData`)
- تحديثات الحالة الداخلية (`statusMap`, `historyMap`, `expandedId`)
- المكونات الفرعية (إدارة الفروع، التجار...) التي تنفذ عملياتها الخاصة

— يُعاد ضبط التبويب إلى القيمة الافتراضية "shipments".

نفس المشكلة موجودة (بدرجة أخف) في:
- `src/components/courier/CourierWalletPanel.tsx` (`defaultValue="ledger"`)
- `src/components/admin/AdminCouriersManagement.tsx` (`defaultValue="info"` داخل Dialog)

أما `CourierOrders.tsx` و `AdminSettlements.tsx` فمستخدمان بشكل صحيح (controlled).

## الحل

### 1. `src/pages/AdminLogistics.tsx` (الأهم)
- إضافة `const [activeTab, setActiveTab] = useState<string>(...)` 
- تحويل `<Tabs defaultValue="shipments">` إلى `<Tabs value={activeTab} onValueChange={setActiveTab}>`
- **حفظ التبويب النشط في `sessionStorage`** بمفتاح `admin-active-tab` ليبقى محفوظاً حتى عند إعادة تحميل الصفحة (F5) أو فتح/إغلاق Dialog.
- القيمة الابتدائية تُقرأ من `sessionStorage` أو "shipments" كاحتياطي.

### 2. `src/components/courier/CourierWalletPanel.tsx`
- نفس النمط: تحويل من uncontrolled إلى controlled مع حفظ في `sessionStorage` بمفتاح `courier-wallet-tab`.

### 3. `src/components/admin/AdminCouriersManagement.tsx`
- التبويب موجود داخل Dialog لتفاصيل شركة شحن. التحويل إلى controlled مع إعادة الضبط إلى "info" عند فتح dialog جديد لشركة مختلفة.

### 4. (وقاية) `MerchantSettingsPage` وأي صفحات تبويبات أخرى
- مراجعة سريعة لباقي الصفحات وإضافة نفس النمط لو وُجدت `Tabs` بدون تحكم.

## ملاحظة جانبية مهمة
المكون `AdminBranchesManagement` (تبويب "فروع الشحن") يستدعي `fetchData` على الأرجح بعد كل عملية إضافة/تعديل، مما يُسبب re-render للأب `AdminLogistics`. حتى بعد تحويل `Tabs` إلى controlled، يجب التأكد أن `fetchData` في `AdminLogistics` لا يُستدعى دون داعٍ بعد عمليات في تبويبات لا علاقة لها بالشحنات. لكن هذا تحسين أداء — الإصلاح الأساسي (controlled tabs) سيحل المشكلة الظاهرة للمستخدم بشكل كامل.

## النتيجة المتوقعة
- ستبقى في تبويب "فروع الشحن" أثناء إضافة الفروع دون أن تُرحَّل إلى "إدارة الشحنات".
- التبويب المختار سيُحفظ حتى لو حدّثت الصفحة.
- نفس السلوك المحسَّن سيُطبَّق على محفظة المندوب وحوار تفاصيل شركة الشحن.
