"use client";

import { ACTION_META } from "@/types/energy";
import { LOAD_PRESETS, loadsCapacityW } from "@/lib/energy/scenarios";
import { useSolar } from "./SolarProvider";

/** Concise live report built only from current simulation values. */
export default function ProductionReport() {
  const { sim, calc, decision, result, lang } = useSolar();
  const ar = lang === "ar";
  const meta = ACTION_META[decision.recommendedAction];
  const activeLoads = LOAD_PRESETS.filter((l) => sim.availableLoads.includes(l.id));
  const rows: [string, string][] = [
    [ar ? "إنتاج الطاقة" : "Solar production", `${calc.solarProductionW} W`],
    [ar ? "استهلاك المنزل" : "Home consumption", `${calc.consumptionW} W`],
    [ar ? "صافي الطاقة" : "Net energy", `${calc.netEnergyW >= 0 ? "+" : ""}${calc.netEnergyW} W`],
    [ar ? "الفائض المتاح" : "Available surplus", `${calc.excessEnergyW} W`],
    [ar ? "العجز" : "Shortage", `${calc.energyShortageW} W`],
    [ar ? "تغطية الاستهلاك" : "Demand coverage", `${calc.selfCoveragePct}%`],
    [ar ? "البطارية" : "Battery", sim.batteryAvailable ? `${sim.batteryLevelPct}% · ${sim.batteryCapacityWh} Wh` : ar ? "غير متاحة" : "Unavailable"],
    [ar ? "الأحمال النشطة" : "Active loads", activeLoads.length ? `${activeLoads.length} · ~${loadsCapacityW(sim.availableLoads)} W` : ar ? "لا يوجد" : "None"],
  ];
  return <section className="section production-report" aria-label={ar ? "تقرير الإنتاج" : "Production report"}>
    <div className="section-heading"><h2>{ar ? "تقرير الإنتاج" : "Production report"}</h2><span className="badge">{result ? result.source === "ai" ? (ar ? "ذكاء اصطناعي" : "AI response") : (ar ? "استجابة احتياطية" : "Server fallback") : (ar ? "معاينة محلية" : "Local preview")}</span></div>
    <dl className="report-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd dir="ltr">{value}</dd></div>)}</dl>
    {activeLoads.length > 0 && <ul className="report-loads">{activeLoads.map((l) => <li key={l.id}>{ar ? l.ar : l.en} · <span dir="ltr">~{l.watts}W</span></li>)}</ul>}
    <p className="report-decision" dir="auto"><strong>{ar ? meta.labelAr : meta.labelEn}</strong> — {decision.reason}</p>
    <p className="small muted">{ar ? "تقرير وصفي للقيم الحالية فقط. لا توجد قياسات حقيقية أو وفورات مثبتة." : "A descriptive summary of current values only. No real measurements or proven savings."}</p>
  </section>;
}
