# Smart Solar ESP32 Starter

هذا الكود نقطة بداية للمراقبة فقط. لا يوجد في المشروع الحالي تشغيل أحمال أو عاكس أو شاحن.

## المساران

### USB / Web Serial

1. ثبّت Arduino IDE وESP32 board support.
2. ثبّت مكتبة `DHT sensor library` إذا كان حساس DHT11 موصلًا.
3. افتح `solar_telemetry.ino` واختر لوحة ESP32 والمنفذ الصحيح.
4. راجع قيم المعايرة وثوابت الأرجل قبل الرفع.
5. ارفع الكود وافتح الموقع في Chrome/Edge على جهاز يدعم Web Serial.
6. اضغط `Simulation` ثم اختر `ESP32 Live` من الترويسة.
7. وافق على منفذ USB.

الكود يرسل JSON سطرًا كل 5 ثوانٍ عبر Serial بسرعة `115200`. الواجهة تقرأ الحقول:

```json
{"solarProductionW":1000,"consumptionW":300,"batteryLevelPercent":40}
```

القيم الواردة تُحدّث الحالة المشتركة، وتبطل القرار القديم. اضغط تحليلًا جديدًا لتشغيل AI على الحالة الجديدة.

### Wi-Fi / Telemetry API

1. املأ `WIFI_SSID` و`WIFI_PASSWORD` محليًا على الجهاز فقط.
2. ضع عنوان HTTPS الفعلي في `TELEMETRY_URL`.
3. غيّر `ENABLE_WIFI_TELEMETRY` إلى `true`.
4. أرسل الرسائل إلى:

```text
POST /api/telemetry
```

المسار الحالي يتحقق من الرسالة ويعيد acknowledgement فقط. لا يحفظ القياسات ولا يروجها إلى `SystemState` الخادم بعد.

## توصيل الحساسات

الأرجل الافتراضية في الكود:

| الإشارة | GPIO | الملاحظات |
|---|---:|---|
| Voltage sensor | 34 | يجب أن يكون الخرج ضمن مدى ADC وبواجهة معزولة/مقسّم مصمم بعناية |
| ACS712 / conditioned SCT-013 | 35 | ACS712 لدوائر منخفضة الجهد المعزولة فقط؛ SCT-013 يحتاج burden/interface مناسب |
| LDR | 32 | قراءة ضوء اختيارية، وليست بديلًا عن قياس إنتاج شمسي معاير |
| DHT11 | 4 | درجة حرارة عامة اختيارية؛ لا تمثل قياس حرارة اللوح |

### تحذير سلامة

- لا توصل الألواح أو البطاريات أو كهرباء المنزل مباشرة إلى GPIO.
- لا تستخدم هذا الكود لقياس أو التحكم في جهد/تيار غير معروف.
- اختيار الحساس والعزل والحماية والمعايرة يجب أن يراجعه مختص كهربائي.
- `readConsumptionW()` يعيد `NAN` افتراضيًا حتى تتم إضافة حساس استهلاك معاير؛ الخادم يرفض العينة بدل اختراع استهلاك. بعد مراجعة الدائرة والمعايرة يمكن تفعيل `ENABLE_CONSUMPTION_SENSOR` واستخدام GPIO33 مع جهد النظام الاسمي المحدد في الكود.
- ثوابت ADC والمعايرة placeholders وليست نتائج قياس.

## عقد البيانات

المثال الكامل:

```json
{
  "schemaVersion": 1,
  "deviceId": "solar-prototype-01",
  "sequence": 42,
  "measuredAt": "not-set-on-device",
  "source": "hardware",
  "measurements": {
    "solarProductionW": 1000,
    "consumptionW": 300,
    "batteryLevelPercent": null,
    "temperatureC": 35,
    "lightRaw": 2500
  },
  "quality": {
    "solar": "calibration_required",
    "consumption": "not_available",
    "batteryLevel": "not_available"
  }
}
```

## التنبؤ والـML

لا يوجد نموذج تنبؤ منفذ حاليًا. عند إضافة بيانات تاريخية، يمكن بناء خدمة توقع منفصلة تنتج مثلًا `estimatedSolarProductionNextHourW`، ثم تُضاف إلى `DecisionRequest.environment`. لا ينبغي جعل التوقع يعيد حساب الصافي أو يتجاوز قراءات اللحظة؛ دوره تحسين التوصية فقط. يجب فصل تقييم التوقع عن تقييم قرار الطاقة.
