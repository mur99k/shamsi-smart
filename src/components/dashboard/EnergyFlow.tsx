"use client";

import { useState } from "react";
import { Battery, Car, Plug, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import type { EnergyCalc } from "@/lib/energy/types";
import type { RecommendedAction } from "@/types/energy";
import type { Lang } from "./lang";

const HOME_PATH = "M250 118 C 320 118, 350 122, 428 122";
const TRUNK_PATH = "M320 116 V 218";

export default function EnergyFlow({ calc, batteryLevelPct, batteryCapacityWh, active, lang }: {
  calc: EnergyCalc; batteryLevelPct: number; batteryCapacityWh: number; active: RecommendedAction; lang: Lang;
}) {
  const ar = lang === "ar";
  const [inspected, setInspected] = useState<string | null>(null);
  const sinks = [
    { id: "battery_storage", Icon: Battery, label: ar ? "البطارية" : "Battery", detail: ar ? `مستوى افتراضي ${batteryLevelPct}% بسعة ${batteryCapacityWh}Wh. لا تُحاكى قدرة الشحن الفعلية.` : `Simulated level ${batteryLevelPct}% of ${batteryCapacityWh}Wh. Actual charging power is not simulated.` },
    { id: "ev_charging", Icon: Car, label: ar ? "السيارة" : "EV", detail: ar ? "تُقترح السيارة المتاحة كوجهة للفائض وفق الحالة. لا توجد جلسة شحن حقيقية." : "An available EV can be recommended for surplus power. No real charging session is running." },
    { id: "additional_load", Icon: Plug, label: ar ? "الأحمال" : "Loads", detail: ar ? "أجهزة افتراضية تختارها في إعدادات المحاكاة. التوصية لا تشغّل أجهزة فعلية." : "Virtual appliances selected in simulation settings. A recommendation does not turn on physical devices." },
    { id: "reduce_solar_input", Icon: SlidersHorizontal, label: ar ? "تقليل الإنتاج" : "Curtailment", detail: ar ? "توصية بتقليل الإنتاج عند ملاءمة الحالة. لا يُرسل أمر إلى العاكس." : "A recommendation to reduce generation when appropriate. No inverter command is sent." },
  ];
  const status = calc.status === "SURPLUS" ? (ar ? "فائض متاح" : "Surplus available") : calc.status === "SHORTAGE" ? (ar ? "عجز غير مغطى" : "Uncovered shortage") : (ar ? "طاقة متوازنة" : "Energy balanced");
  const homeRunning = calc.solarProductionW > 0 && calc.consumptionW > 0;
  const flowing = calc.excessEnergyW > 0;
  const routed = flowing && sinks.some(sink => sink.id === active);
  const flowSpeed = flowing ? `${Math.max(0.9, 3.2 - calc.excessEnergyW / 400).toFixed(2)}s` : undefined;
  const winGlow = calc.consumptionW <= 0 ? 0.25 : Math.min(1, 0.35 + calc.consumptionW / 1500);
  const haloGlow = calc.solarProductionW <= 0 ? 0.12 : Math.min(1, 0.3 + calc.solarProductionW / 1500);
  const caption = routed
    ? (ar ? "وجهة الفائض المقترحة" : "Suggested surplus destination")
    : calc.status === "BALANCED"
      ? (ar ? "متوازن — الإنتاج يغطي المنزل تمامًا، ولا فائض للتوجيه" : "Balanced — solar covers home exactly, nothing to route")
      : (ar ? `عجز ${calc.energyShortageW}W — المنزل يحتاج أكثر مما تنتجه الشمس، ولا فائض للتوجيه` : `Shortage of ${calc.energyShortageW}W — home needs more than solar provides, nothing to route`);
  return <section className={`energy-scene state-${calc.status.toLowerCase()}`} aria-label={ar ? "ميزان الطاقة" : "Energy balance"} style={flowSpeed ? ({ "--flow-speed": flowSpeed } as CSSProperties) : undefined}>
    <div className="scene-heading"><h2>{ar ? "اتبع الطاقة" : "Follow the energy"}</h2><span className={`badge status-${calc.status.toLowerCase()}`}>{status}</span></div>
    <div className="power-labels"><div><span>{ar ? "إنتاج شمسي" : "Solar generation"}</span><strong dir="ltr" className="num">{calc.solarProductionW}<small> W</small></strong></div><div><span>{ar ? "طلب المنزل" : "Home demand"}</span><strong dir="ltr" className="num">{calc.consumptionW}<small> W</small></strong></div></div>
    <svg className="power-landscape" viewBox="0 0 640 220" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="panelDeep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#274e9e" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="wallLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dcebe2" />
        </linearGradient>
        <linearGradient id="roofLight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6d8a7c" />
          <stop offset="100%" stopColor="#3d5c51" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6d878" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f6d878" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sunBall" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fff7d6" />
          <stop offset="55%" stopColor="#f6c945" />
          <stop offset="100%" stopColor="#b97f14" />
        </radialGradient>
        <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <rect x="30" y="164" width="580" height="26" rx="10" fill="#0f2e25" opacity="0.22" />
      <rect x="30" y="148" width="580" height="20" rx="10" fill="#ffffff" opacity="0.5" stroke="#7dd3b8" strokeWidth="1.5" />
      <g stroke="#94a3b8" strokeWidth="1" opacity="0.35">
        <path d="M40 162H600M40 176H600" />
        <path d="M120 190L200 150M260 190L320 150M400 190L440 150M520 190L560 150" />
      </g>
      <rect x="34" y="150" width="572" height="16" rx="8" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
      <ellipse cx="165" cy="150" rx="105" ry="13" fill="#0f2e25" opacity="0.14" filter="url(#softShadow)" />
      <ellipse cx="505" cy="152" rx="100" ry="13" fill="#0f2e25" opacity="0.14" filter="url(#softShadow)" />
      <circle cx="60" cy="32" r="27" fill="url(#sunGlow)" opacity={haloGlow} />
      <circle cx="60" cy="32" r="21" fill="none" stroke="#e9b93c" strokeWidth="1.5" strokeDasharray="4 7" opacity="0.8" className="orbit orbit-a" />
      <circle cx="60" cy="32" r="30" fill="none" stroke="#e9b93c" strokeWidth="1" strokeDasharray="2 9" opacity="0.55" className="orbit orbit-b" />
      <circle cx="60" cy="32" r="14" fill="url(#sunBall)" />
      <g stroke="#996a15" strokeWidth="2"><path d="M60 8V2M60 56V62M36 32H30M84 32H90M43 15L39 11M77 49L81 53M43 49L39 53M77 15L81 11" /></g>
      <rect x="110" y="106" width="10" height="42" fill="#9fb6aa" stroke="#667d75" strokeWidth="1.5" />
      <rect x="205" y="121" width="10" height="27" fill="#9fb6aa" stroke="#667d75" strokeWidth="1.5" />
      <path d="M110 130H215" stroke="#667d75" strokeWidth="3" />
      <polygon points="95,52 265,78 242,128 72,102" fill="url(#panelDeep)" stroke="#172f6b" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="120,58 150,63 128,112 100,107" fill="#ffffff" opacity="0.1" />
      <g stroke="#bfdbfe" strokeWidth="1.2" opacity="0.85">
        <path d="M110 60L88 108M150 67L128 115M190 74L168 122M225 80L205 128" />
        <path d="M80 80L250 106M76 94L246 120" />
      </g>
      <path d="M432 66V148H540V66" stroke="#9fb6aa" strokeWidth="2" fill="url(#wallLight)" />
      <polygon points="540,66 583,82 583,164 540,148" fill="#c9ddd2" stroke="#9fb6aa" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="418,66 485,26 552,66" fill="url(#roofLight)" stroke="#2f4a40" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="552,66 485,26 528,38 595,78" fill="#334f44" stroke="#2f4a40" strokeWidth="2" strokeLinejoin="round" />
      <path d="M485 26L528 38" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M462 40H508M445 50H525M430 60H540" stroke="#2f4a40" strokeWidth="1" opacity="0.55" />
      <path d="M546 54L562 59M552 62L566 66" stroke="#22382f" strokeWidth="1" opacity="0.55" />
      <rect x="468" y="106" width="17" height="42" fill="#627c6a" stroke="#4c655a" strokeWidth="1.5" />
      <rect x="440" y="86" width="22" height="20" fill="#fef08a" opacity={winGlow} stroke="#9fb6aa" strokeWidth="1.5" />
      <rect x="508" y="86" width="22" height="20" fill="#fef08a" opacity={winGlow} stroke="#9fb6aa" strokeWidth="1.5" />
      <polygon points="556,96 572,102 572,120 556,114" fill="#fef08a" opacity={winGlow} stroke="#9fb6aa" strokeWidth="1.5" />
      <path d="M275 118H305Q320 118 320 124" stroke="#b4c9bf" strokeWidth="3" fill="none" />
      <path data-flow="home" data-running={homeRunning} className="flow-current track" d={HOME_PATH} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M320 116V218" stroke="#b4c9bf" strokeWidth="3" />
      <path data-flow="surplus" data-running={routed} className="flow-current track" d={TRUNK_PATH} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="320" cy="114" r="8" fill={routed ? "#f59e0b" : "#b4c9bf"} stroke="#eaf3ed" strokeWidth="3" className="flow-node" data-running={routed} />
      {homeRunning && (<g aria-hidden="true">
        <circle className="orb orb-home-a" r="5.5" cx="0" cy="0" />
        <circle className="orb orb-home-b" r="5.5" cx="0" cy="0" />
        {routed && <circle className="orb orb-trunk" r="5.5" cx="0" cy="0" />}
      </g>)}
    </svg>
    <div className="sink-tree" data-flowing={flowing}>
      <div className="sink-list">{sinks.map(({ id, Icon, label }) => {
        const selected = flowing && active === id;
        return <button key={id} data-sink={id} data-active={selected} aria-expanded={inspected === id} aria-controls="sink-explanation" onClick={() => setInspected(inspected === id ? null : id)} className={selected ? "sink selected" : "sink"}><Icon size={23} strokeWidth={1.5} /><span>{label}</span><small>{selected ? (ar ? "مقترح" : "Suggested") : flowing ? (ar ? "متاح" : "Available") : (ar ? "غير موجه" : "Not routed")}</small><ChevronDown size={12} className="sink-chevron" /></button>;
      })}</div>
    </div>
    <div id="sink-explanation" className="sink-explanation" hidden={!inspected}>{sinks.find(sink => sink.id === inspected)?.detail}</div>
    <div className="routing-caption">{caption}</div>
    <dl className="balance-totals"><div><dt>{ar ? "فائض متاح" : "Available surplus"}</dt><dd dir="ltr">{calc.excessEnergyW} W</dd></div><div><dt>{ar ? "عجز غير مغطى" : "Uncovered shortage"}</dt><dd dir="ltr">{calc.energyShortageW} W</dd></div></dl>
    <p className="scene-note">{ar ? "مسارات توضيحية لتوصية، وليست تدفقاً مقاساً من أجهزة." : "Paths illustrate a recommendation, not measured hardware flow."}</p>
  </section>;
}
