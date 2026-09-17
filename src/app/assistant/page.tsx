"use client";

import Link from "next/link";
import { ACTION_META } from "@/types/energy";
import { useSolar } from "@/components/dashboard/SolarProvider";
import AIChat from "@/components/dashboard/AIChat";

export default function AssistantPage() {
  const { sim, calc, lang, decision, result } = useSolar();
  const ar = lang === "ar";
  const meta = ACTION_META[decision.recommendedAction];
  const rows = [
    [ar ? "الإنتاج الشمسي" : "Solar production", `${sim.solarProductionW} W`],
    [ar ? "الاستهلاك" : "Consumption", `${sim.consumptionW} W`],
    [ar ? "الصافي" : "Net power", `${calc.netEnergyW} W`],
    [ar ? "الفائض" : "Surplus", `${calc.excessEnergyW} W`],
    [ar ? "العجز" : "Shortage", `${calc.energyShortageW} W`],
    [ar ? "البطارية" : "Battery", `${sim.batteryLevelPct}% / ${sim.batteryCapacityWh} Wh`],
    [ar ? "البطارية متصلة" : "Battery connected", sim.batteryAvailable ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")],
    [ar ? "السيارة متاحة" : "EV available", sim.evAvailable ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")],
    [ar ? "السيارة قيد الشحن" : "EV charging", sim.evAvailable && sim.evCharging ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")],
    [ar ? "عدد الأحمال" : "Available loads", String(sim.availableLoads.length)],
    [ar ? "توقع الإنتاج" : "Solar forecast", `${sim.futureSolarEstimateW} W`],
    [ar ? "وقت المحاكاة" : "Simulation time", sim.currentTime],
  ];
  return <>
    <div className="page-heading"><div><h1>{ar ? "مساعد الطاقة" : "Energy Assistant"}</h1><p>{ar ? "نقاش مبني على حالة المحاكاة الحالية." : "A conversation grounded in the current simulation state."}</p></div></div>
    <div className="assistant-grid"><AIChat /><aside className="system-context"><div className="section-heading"><h2>{ar ? "السياق الحالي" : "Current context"}</h2><Link href="/simulator">{ar ? "تعديل" : "Edit"}</Link></div><div className="assistant-state-label">{calc.status}</div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl><h3>{ar ? "القرار الحالي" : "Current decision"}</h3><p className="decision-name">{ar ? meta.labelAr : meta.labelEn}</p><span className="badge">{result?.source === "ai" ? "Codex Everywhere" : ar ? "محرك محلي" : "Local engine"}</span><p className="small muted">{ar ? "الأرقام محاكاة وليست قراءات حساسات." : "These are simulated values, not sensor readings."}</p></aside></div>
  </>;
}
