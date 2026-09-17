"use client";

import { useSolar } from "@/components/dashboard/SolarProvider";

export default function HardwarePage() {
  const { lang } = useSolar();
  const ar = lang === "ar";
  const steps = ar ? [
    ["حساسات التيار والجهد", "قياس الإنتاج والاستهلاك ومستوى البطارية. يتطلب اختيار الحساسات ومعايرتها وحماية الدوائر."],
    ["ESP32 / Arduino", "جمع القياسات وإرسالها إلى بوابة محلية. البرنامج الثابت والاتصال لم ينفذا بعد."],
    ["Raspberry Pi · بوابة مستقبلية", "بوابة مقترحة لتجميع القياسات والتحقق منها وتحويلها إلى DecisionRequest. ليست متصلة بهذا النموذج."],
    ["محرك القرار والمساعد", "تغذية عقود API الحالية ببيانات متحققة بدلاً من قيم المحاكاة، بعد تنفيذ طبقة تكامل واختبارها."],
    ["تشغيل الأحمال بأمان", "مرحلة مستقبلية منفصلة تتطلب حماية كهربائية، حدود تشغيل، إيقافاً يدوياً ومراجعة مختص. التوصية ليست أمر تشغيل."],
  ] : [
    ["Current & voltage sensors", "Measure generation, consumption and battery state. Sensor selection, calibration and circuit protection are required."],
    ["ESP32 / Arduino", "Collect readings and send them to a local gateway. Firmware and connectivity are not implemented."],
    ["Raspberry Pi · future gateway", "A proposed gateway to aggregate, validate and map readings to DecisionRequest. It is not connected to this prototype."],
    ["Decision engine & assistant", "Feed validated measurements into existing API contracts after implementing and testing an integration layer."],
    ["Safe load control", "A separate future stage requiring electrical protection, operating limits, manual override and qualified review. A recommendation is not an actuator command."],
  ];
  return <>
    <div className="page-heading"><div><h1>{ar ? "خطة تكامل العتاد" : "Hardware roadmap"}</h1><p>{ar ? "الخطوة التالية المقترحة، وليست اتصالًا قائمًا." : "A planned next stage, not a live connection."}</p></div><span className="badge">{ar ? "مخطط" : "Planned"}</span></div>
    <p className="notice">{ar ? "الوضع الحالي: محاكاة برمجية. لا توجد حساسات أو ESP32 أو Raspberry Pi أو أحمال فعلية متصلة." : "Current mode: software simulation. No sensors, ESP32, Raspberry Pi or physical loads are connected."}</p>
    <div className="hardware-pipeline-visual" aria-label={ar ? "مسار تكامل العتاد" : "Hardware integration path"}>
      {[ar ? "لوح شمسي" : "Solar panel", ar ? "حساسات الجهد والتيار" : "Voltage / current sensors", "ESP32 / Arduino", "Raspberry Pi", "Telemetry → SystemState", ar ? "محرك الطاقة والقرار" : "Energy + decision engine"].map((step, index) => <div className="hardware-node" key={step}><span className="hardware-node-index">0{index + 1}</span><strong>{step}</strong>{index < 5 && <span className="hardware-node-arrow" aria-hidden="true">↓</span>}</div>)}
    </div>
    <ol className="pipeline">{steps.map(([title, body]) => <li key={title}><h2>{title}</h2><p>{body}</p><span className="badge">{ar ? "غير منفذ" : "Not implemented"}</span></li>)}</ol>
  </>;
}
