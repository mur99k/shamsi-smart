# لوحة التحكم الحية — دليل التنفيذ

> **Snapshot:** commit `1430351` · Next.js 16.3.5 · React 19 · Tailwind v4 · TypeScript strict
> هذا الملف يشرح **كيف** بُنيت اللوحة، وليس بديلاً عن الكود نفسه. الكود الحقيقي في المسارات المذكورة.

---

## 1. تدفق البيانات (لا بيانات وهمية في أي خطوة)

```
ESP32 ─┬─ USB  (Web Serial, 115200, JSON سطر لكل قراءة) ─┐
       ├─ BLE  (Nordic UART 6e400001…, JSON)            ├─→ ingestReading()
       └─ Cloud (POST /api/telemetry → GET كل 5 ثوانٍ)   ─┘        │
                                                                   ├─ deviceReading (آخر قراءة)
                                                                   ├─ history[]     (60 عيّنة)
                                                                   ├─ studyTotals   (تكامل Wh)
                                                                   └─ decisionLog[] (عند تغيّر القرار)
                                                                          │
                                                          LiveDashboard (9 أقسام)
```

قاعدة واحدة تحكم الكل: `ingestReading(reading, source)` في `SolarProvider.tsx`.
أي مسار جديد (Wi‑Fi، LoRa…) يكفي أن يبني نفس الشكل ويستدعي هذه الدالة.

## 2. عقد القراءة

```ts
// src/lib/energy/live.ts
export interface LiveReading {
  solarW: number;        // INA219 0x41
  loadW: number;         // INA219 0x44
  batteryW: number | null;   // INA219 0x40 — إشارة موجبة = شحن
  batteryV: number | null;
  batteryA: number | null;
  batteryPct: number | null; // null = لا يوجد BMS (لا نخترع)
  lux: number | null;        // BH1750
  tempC: number | null;      // DHT11
  humidity: number | null;   // DHT11
  relay: "on" | "off" | null; // GPIO 19
}
```

`null` ليست قيمة صفر: معناها **غير مقيس**، وتُعرض «—» في الواجهة.

JSON المتوقع من الجهاز (سطر واحد لكل قراءة):

```json
{"solarProductionW":842,"consumptionW":315,"batteryPowerW":-18,
 "batteryVoltageV":12.64,"batteryCurrentA":-1420,"batteryLevelPercent":64,
 "lightLux":51200,"temperatureC":31.2,"humidityPct":38,"relay":"off"}
```

## 3. الملفات

| الملف | الدور | سطور |
|---|---|---|
| `src/components/dashboard/LiveDashboard.tsx` | الأقسام التسعة بـ Tailwind | 361 |
| `src/components/dashboard/SolarProvider.tsx` | القنوات، القراءة الموحّدة، السجل، التكامل، الريليه | 615 |
| `src/lib/energy/live.ts` | قرار مبني على القياس + حالة البطارية | 74 |
| `src/app/dashboard/page.tsx` | تركيب اللوحة + فاصل المحاكاة | 24 |

## 4. خريطة الأقسام → الحساسات

| القسم | من أين يأتي الرقم |
|---|---|
| نظرة عامة (إنتاج/استهلاك/صافي/فائض/عجز/توازن) | `solarW`, `loadW` مباشرة |
| تحليل البطارية (SOC/V/A/P + ممتلئة/متوسطة/منخفضة) | `battery*` عبر USB/BLE فقط |
| قرار النظام + السبب | `liveDecision()` من الفرق المقيس |
| التوزيع (مباشر/بطارية/غير موجَّه) | تفكيك `solarW` على `loadW` و`batteryW` |
| التوصية | نفس فرق القدرة + حالة التخزين |
| المراقبة المباشرة (منحنى) | `history[]` — SVG بلا مكتبات |
| مؤشرات الدراسة (Wh، استهلاك ذاتي، ذروة) | تكامل زمني `P × Δt` لأسوأ/أفضل الحالات |
| سجل القرارات | يُضاف سطر عند تغيّر نوع القرار فقط |
| الريليه GPIO 19 | `setRelayCommand()` → BLE ← USB ← سحابة |

## 5. قرار مبني على القياس

```ts
const net = solarW - loadW;

net < -5            → energy_shortage   (عجز: أوقف الحمل غير الأساسي)
|net| <= 5          → no_action         (توازن)
net > 5 && batt>5   → battery_storage   (التخزين يعمل الآن)
net > 5 && relay on → additional_load   (الفائض يغذّي الحمل)
net > 5             → battery_storage   (فائض غير موجَّه: اربط البطارية أو شغّل حملًا)
```

كل قرار يحمل `reason` مبنية على الأرقام نفسها، لا نص جاهز.

## 6. حدود صادقة

1. **الجهد/التيار/القدرة للبطارية** لا تصل عبر السحابة — الحقول اختيارية في `POST /api/telemetry`، واللوحة تعرض «—» بدل تخمين.
2. **SOC** يحتاج BMS؛ بدونه تُستنتج الحالة من إشارة القدرة فقط.
3. **مؤشرات الدراسة** جلسة حالية تُصفَّر عند التحديث؛ الدراسة الميدانية تحتاج تسجيلًا دائمًا (KV/DB) وأسابيع قياس.
4. **عمر القراءة 15 ثانية** — بعدها تتحول اللوحة إلى «قديمة» وتُخفى الأرقام كحالية.

## 7. التشغيل

```bash
npm run dev      # تطوير
npm run build && npm run start   # عرض أمام اللجنة (أسرع وأثبت)
```

بدون جهاز: `/simulator` يعمل بقيمه الحالية، و`/dashboard` يعرض حالة فارغة صريحة.
