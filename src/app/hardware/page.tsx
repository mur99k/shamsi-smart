"use client";

import { ArrowDown, ArrowLeft, ArrowRight, Gauge, Sun, Cpu, ToggleRight, BrainCircuit, Wifi, Server } from "lucide-react";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function HardwarePage() {
  const { lang } = useSolar();
  const ar = lang === "ar";
  const Forward = ar ? ArrowLeft : ArrowRight;

  const stages = [
    { icon: Gauge, titleAr: "المستشعرات", titleEn: "Sensors", descAr: "INA219 للتيار والجهد + BH1750 للضوء", descEn: "INA219 for current & voltage + BH1750 for light" },
    { icon: Cpu, titleAr: "المعالج ESP32", titleEn: "ESP32 processor", descAr: "يجمع القراءات ويرسلها عبر الواي فاي", descEn: "Collects readings and sends them over Wi-Fi" },
    { icon: BrainCircuit, titleAr: "خادم الذكاء الاصطناعي", titleEn: "AI server", descAr: "يحلل الحالة ويختار القرار الأمثل", descEn: "Analyzes the state and picks the optimal decision" },
    { icon: ToggleRight, titleAr: "التحكم بالأحمال", titleEn: "Load control", descAr: "الريليهات والأحمال تنفذ القرار", descEn: "Relays & loads execute the decision" },
  ];

  const parts = [
    { icon: Gauge, color: "amber", titleAr: "حساسات INA219 ×3", titleEn: "3× INA219 sensors", descAr: "قياس التيار والجهد للإنتاج والاستهلاك والبطارية", descEn: "Current & voltage for solar, load and battery", meta: "I2C: 0x40 · 0x41 · 0x44", badgeAr: "مجهز للتركيب 🟢", badgeEn: "Ready to install 🟢", ok: true },
    { icon: Sun, color: "yellow", titleAr: "حساس الضوء BH1750", titleEn: "BH1750 light sensor", descAr: "قياس شدة الإضاءة لتوقع الإنتاج الشمسي", descEn: "Light intensity to anticipate solar output", meta: "I2C", badgeAr: "مجهز للتركيب 🟢", badgeEn: "Ready to install 🟢", ok: true },
    { icon: Cpu, color: "violet", titleAr: "المتحكم ESP32", titleEn: "ESP32 controller", descAr: "العقل الميداني الذي يرسل البيانات لاسلكيًا", descEn: "The field unit streaming data wirelessly", meta: "Wi-Fi", badgeAr: "قيد التوصيل 🟡", badgeEn: "Connecting 🟡", ok: false },
    { icon: ToggleRight, color: "teal", titleAr: "وحدة الريليهات والأحمال", titleEn: "Relays & loads unit", descAr: "مفاتيح كهربائية لتشغيل الأحمال والشواحن بأمان", descEn: "Electrical switches for safe load and charger control", meta: "AC / DC", badgeAr: "قيد التوصيل 🟡", badgeEn: "Connecting 🟡", ok: false },
    { icon: Server, color: "blue", titleAr: "بوابة Raspberry Pi", titleEn: "Raspberry Pi gateway", descAr: "بوابة مستقبلية لتجميع القراءات والتحقق منها", descEn: "A future gateway to aggregate and validate readings", meta: "Raspberry Pi", badgeAr: "مرحلة مستقبلية 🔵", badgeEn: "Future stage 🔵", ok: false },
  ];

  return <>
    <div className="page-heading"><div><h1>{ar ? "الأجهزة والمكونات الفيزيائية" : "Physical Devices & Components"}</h1><p>{ar ? "استعراض الأجهزة والمستشعرات المادية ومسار ربطها مع محرك الذكاء الاصطناعي." : "Physical devices and sensors, and how they connect to the AI engine."}</p></div><span className="badge">{ar ? "مخطط" : "Planned"}</span></div>
    <p className="notice">{ar ? "الوضع الحالي: محاكاة برمجية. لا توجد حساسات أو ESP32 أو Raspberry Pi أو أحمال فعلية متصلة." : "Current mode: software simulation. No sensors, ESP32, Raspberry Pi or physical loads are connected."}</p>

    <section className="hw-hub-panel">
      <h2>{ar ? "مسار التكامل" : "Integration path"}</h2>
      <ol className="hw-stepper">
        {stages.map((s, i) => <li key={s.titleEn} className="hw-stage">
          <span className="hw-stage-dot"><s.icon size={20} /><span className="hw-stage-num" dir="ltr">{i + 1}</span></span>
          <div className="hw-stage-text"><strong>{ar ? s.titleAr : s.titleEn}</strong>
          <p>{ar ? s.descAr : s.descEn}</p></div>
          {i < stages.length - 1 && <span className="hw-link-h" aria-hidden="true"><Forward size={22} /></span>}
          {i < stages.length - 1 && <span className="hw-link-v" aria-hidden="true"><ArrowDown size={22} /></span>}
        </li>)}
      </ol>
    </section>

    <section className="hw-hub-panel">
      <h2>{ar ? "المكونات المادية" : "Hardware components"}</h2>
      <div className="hw-comp-grid">
        {parts.map(p => <article key={p.titleEn} className={`hw-comp-card ${p.color}`}>
          <span className="hw-comp-icon"><p.icon size={22} /></span>
          <h3>{ar ? p.titleAr : p.titleEn}</h3>
          <p>{ar ? p.descAr : p.descEn}</p>
          <code dir="ltr">{p.meta}</code>
          <span className={p.ok ? "hw-status ok" : "hw-status pending"}>{ar ? p.badgeAr : p.badgeEn}</span>
          {p.titleEn === "ESP32 controller" && <small className="hw-wifi"><Wifi size={13} /> {ar ? "الاتصال بالواي فاي: عند التركيب" : "Wi-Fi link: on installation"}</small>}
        </article>)}
      </div>
    </section>
  </>;
}
