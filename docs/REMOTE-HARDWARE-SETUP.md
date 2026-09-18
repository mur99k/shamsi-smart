# Remote Hardware Setup

## الوضع الحالي

الموقع يدعم Software Simulation، وتجهيز Web Serial تجريبي، وعقد `POST /api/telemetry` للتحقق. لا توجد مصادقة أجهزة أو تخزين أو ترقية خادم telemetry إلى SystemState حتى الآن.

## جدة / الرياض

### المعرض أو التجربة المباشرة عبر USB

- ESP32 متصل بلابتوب الرياض.
- Chrome/Edge يفتح الموقع على نفس اللابتوب.
- الترويسة → `Simulation` → `ESP32 Live`.
- Web Serial يقرأ JSON lines من USB.
- لا تحتاج هذه الطريقة إلى إنترنت لقراءة Serial، لكن الموقع نفسه يجب أن يكون متاحًا على اللابتوب.

### المراقبة عبر Wi-Fi

- ESP32 يتصل بشبكة Wi-Fi في الرياض.
- يرسل HTTPS إلى عنوان الموقع العام.
- الخادم يتحقق من العقد فقط حاليًا.
- المتابعة بين جدة والرياض تحتاج أولًا إضافة مصادقة جهاز وتخزين وحالة telemetry حديثة.
- لا ترسلوا بيانات حساسات إلى endpoint عام قبل إضافة Authentication Keys وTLS وسياسة freshness.

## دورة العمل المقترحة

```text
ESP32 sensors
    ↓
JSON telemetry
    ↓
Web Serial USB أو HTTPS POST /api/telemetry
    ↓
Validation + quality + freshness (planned)
    ↓
Hardware Adapter (planned)
    ↓
Shared SystemState
    ↓
Energy Engine → AI Decision / Assistant / Dashboard
```

## ما يجب اختباره قبل العتاد

- Mock JSON sender.
- الرسائل المكررة أو خارج الترتيب.
- قيم `null` والقراءات السالبة.
- انقطاع الاتصال والقراءة القديمة.
- عدم اختراع البطارية عند غياب BMS.
- تحديث القرار بعد قراءة جديدة.

## حدود السلامة

هذا دليل برمجي واتصالي، وليس مخطط تركيب كهربائي. يجب أن يحدد مختص نوع الحساس والعزل ومجال القياس والحماية قبل توصيل أي دائرة.
