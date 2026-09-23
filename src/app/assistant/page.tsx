"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ACTION_META } from "@/types/energy";
import { useSolar } from "@/components/dashboard/SolarProvider";
import AIChat from "@/components/dashboard/AIChat";

export default function AssistantPage() {
  const { sim, calc, lang, decision } = useSolar();
  const ar = lang === "ar";
  const [contextOpen, setContextOpen] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 850px)");
    const sync = () => setContextOpen(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const meta = ACTION_META[decision.recommendedAction];
  const rows = [
    [ar ? "الإنتاج الشمسي" : "Solar production", ar ? `${sim.solarProductionW} واط` : `${sim.solarProductionW} W`],
    [ar ? "الاستهلاك" : "Consumption", ar ? `${sim.consumptionW} واط` : `${sim.consumptionW} W`],
    [ar ? "الصافي" : "Net power", ar ? `${calc.netEnergyW} واط` : `${calc.netEnergyW} W`],
    [ar ? "الفائض" : "Surplus", ar ? `${calc.excessEnergyW} واط` : `${calc.excessEnergyW} W`],
    [ar ? "العجز" : "Shortage", ar ? `${calc.energyShortageW} واط` : `${calc.energyShortageW} W`],
    [ar ? "سعة البطارية" : "Battery level", ar ? `${sim.batteryLevelPct}% (من أصل ${sim.batteryCapacityWh} واط/ساعة)` : `${sim.batteryLevelPct}% (of ${sim.batteryCapacityWh} Wh)`],
    [ar ? "البطارية متصلة" : "Battery connected", sim.batteryAvailable ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")],
    [ar ? "السيارة متاحة" : "EV available", sim.evAvailable ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")],
    [ar ? "السيارة قيد الشحن" : "EV charging", sim.evAvailable && sim.evCharging ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")],
    [ar ? "عدد الأحمال" : "Available loads", String(sim.availableLoads.length)],
    [ar ? "توقع الإنتاج" : "Solar forecast", ar ? `${sim.futureSolarEstimateW} واط` : `${sim.futureSolarEstimateW} W`],
    [ar ? "وقت المحاكاة" : "Simulation time", sim.currentTime],
  ];
  return <>
    <div className="page-heading"><div><h1>{ar ? "مساعد الطاقة" : "Energy Assistant"}</h1><p>{ar ? "نقاش مبني على حالة المحاكاة الحالية." : "A conversation grounded in the current simulation state."}</p></div></div>
    <div className="assistant-grid"><AIChat /><aside className="system-context"><div className="section-heading"><h2>{ar ? "السياق الحالي" : "Current context"}</h2><div className="context-actions"><button className="context-toggle" aria-expanded={contextOpen} onClick={() => setContextOpen(open => !open)}>{contextOpen ? <ChevronDown size={18} className="flipped" /> : <ChevronDown size={18} />}{ar ? "السياق" : "Context"}</button><Link href="/simulator">{ar ? "تعديل" : "Edit"}</Link></div></div><div className="context-body" hidden={!contextOpen}><div className="assistant-state-label">{calc.status}</div><dl className="context-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl><div className="decision-card"><span>{ar ? "القرار الحالي" : "Current decision"}</span><strong>{ar ? meta.labelAr : meta.labelEn}</strong></div><p className="small muted">{ar ? "الأرقام محاكاة وليست قراءات حساسات." : "These are simulated values, not sensor readings."}</p></div></aside></div>
  </>;
}
