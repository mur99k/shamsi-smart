"use client";

import { useState } from "react";
import { Battery, Car, Plug, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { EnergyCalc } from "@/lib/energy/types";
import type { RecommendedAction } from "@/types/energy";
import type { Lang } from "./lang";

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
  const routed = calc.excessEnergyW > 0 && sinks.some(sink => sink.id === active);
  return <section className={`energy-scene state-${calc.status.toLowerCase()}`} aria-label={ar ? "ميزان الطاقة" : "Energy balance"}>
    <div className="scene-heading"><h2>{ar ? "اتبع الطاقة" : "Follow the energy"}</h2><span className={`badge status-${calc.status.toLowerCase()}`}>{status}</span></div>
    <div className="power-labels"><div><span>{ar ? "إنتاج شمسي" : "Solar generation"}</span><strong dir="ltr" className="num">{calc.solarProductionW}<small> W</small></strong></div><div><span>{ar ? "طلب المنزل" : "Home demand"}</span><strong dir="ltr" className="num">{calc.consumptionW}<small> W</small></strong></div></div>
    <svg className="power-landscape" viewBox="0 0 640 242" fill="none" aria-hidden="true">
      <ellipse cx="165" cy="191" rx="108" ry="16" fill="#cfdfd9" />
      <ellipse cx="490" cy="201" rx="103" ry="17" fill="#cfdfd9" />
      <g className={calc.solarProductionW > 0 ? "scene-sun sun-producing" : "scene-sun"} stroke="#996a15" strokeWidth="2"><circle cx="69" cy="45" r="16" fill="#f3d887" /><path d="M69 18V12M69 72V78M42 45H36M96 45H102M50 26L46 22M88 64L92 68M50 64L46 68M88 26L92 22" /></g>
      <path d="M135 152V190M210 152V190" stroke="#667d75" strokeWidth="7" />
      <path d="M85 72H239L271 159H112L85 72Z" fill="#204a42" stroke="#183c35" strokeWidth="3" />
      <path d="M94 81H232L257 149H118L94 81Z" fill="#366a60" />
      <g stroke="#99bcb1" strokeWidth="1.5"><path d="M98 94H237M104 112H244M111 131H251M126 81L150 149M161 81L185 149M196 81L220 149" /></g>
      <path d="M432 115V187L495 211L556 181V108L493 78L432 115Z" fill="#fcfdfa" stroke="#9fb6aa" strokeWidth="2" />
      <path d="M495 134V211L556 181V108L495 134Z" fill="#d9e7df" />
      <path d="M414 113L469 48L514 61L579 107L495 146L414 113Z" fill="#3d5c51" />
      <path d="M414 113L469 48L495 146L414 113Z" fill="#58776a" />
      <path d="M467 140V194L484 202V147L467 140Z" fill="#627c6a" />
      <path d="M442 136V158L458 164V142L442 136ZM509 151V171L526 164V144L509 151ZM535 138V158L548 152V132L535 138Z" fill={calc.solarProductionW > 0 && calc.consumptionW > 0 ? "#e4b954" : "#93aaa1"} />
      <path d="M271 159H305Q320 159 320 174V186Q320 198 337 198H424" stroke="#b4c9bf" strokeWidth="3" />
      <path data-flow="home" data-running={calc.solarProductionW > 0 && calc.consumptionW > 0} className="flow-current" d="M271 159H305Q320 159 320 174V186Q320 198 337 198H424" stroke="#287257" strokeWidth="3" strokeDasharray="5 12" />
      <path d="M320 183V242" stroke="#b4c9bf" strokeWidth="3" />
      <path data-flow="surplus" data-running={routed} className="flow-current" d="M320 183V242" stroke="#287257" strokeWidth="3" strokeDasharray="5 12" />
      <circle cx="320" cy="182" r="7" fill={routed ? "#287257" : "#b4c9bf"} stroke="#eaf3ed" strokeWidth="3" />
    </svg>
    <div className="routing-caption">{routed ? (ar ? "وجهة الفائض المقترحة" : "Suggested surplus destination") : (ar ? "لا يوجد فائض موجّه" : "No surplus routed")}</div>
    <svg className="destination-paths" viewBox="0 0 600 28" preserveAspectRatio="none" fill="none" aria-hidden="true">{sinks.map((sink, index) => {
      const x = 75 + (ar ? 3 - index : index) * 150;
      const path = `M300 0V8H${x}V28`;
      return <g key={sink.id}><path d={path} stroke="#bfd2c3" strokeWidth="1" /><path data-destination={sink.id} data-running={routed && active === sink.id} className="flow-current" d={path} stroke="#287257" strokeWidth="2" strokeDasharray="5 12" /></g>;
    })}</svg>
    <div className="sink-list">{sinks.map(({ id, Icon, label }) => {
      const selected = calc.excessEnergyW > 0 && active === id;
      return <button key={id} data-sink={id} data-active={selected} aria-expanded={inspected === id} aria-controls="sink-explanation" onClick={() => setInspected(inspected === id ? null : id)} className={selected ? "sink selected" : "sink"}><Icon size={23} strokeWidth={1.5} /><span>{label}</span><small>{selected ? (ar ? "مقترح" : "Suggested") : (ar ? "غير موجه" : "Not routed")}</small><ChevronDown size={12} className="sink-chevron" /></button>;
    })}</div>
    <div id="sink-explanation" className="sink-explanation" hidden={!inspected}>{sinks.find(sink => sink.id === inspected)?.detail}</div>
    <dl className="balance-totals"><div><dt>{ar ? "فائض متاح" : "Available surplus"}</dt><dd dir="ltr">{calc.excessEnergyW} W</dd></div><div><dt>{ar ? "عجز غير مغطى" : "Uncovered shortage"}</dt><dd dir="ltr">{calc.energyShortageW} W</dd></div></dl>
    <p className="scene-note">{ar ? "مسارات توضيحية لتوصية، وليست تدفقاً مقاساً من أجهزة." : "Paths illustrate a recommendation, not measured hardware flow."}</p>
  </section>;
}
