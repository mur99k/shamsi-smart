"use client";

import { SCENARIOS } from "@/lib/energy/scenarios";
import { useSolar } from "@/components/dashboard/SolarProvider";
import SimulationControls from "@/components/dashboard/SimulationControls";
import EnergyOverview from "@/components/dashboard/EnergyOverview";
import EnergyFlow from "@/components/dashboard/EnergyFlow";
import AIRecommendation from "@/components/dashboard/AIRecommendation";

export default function SimulatorPage() {
  const { sim, calc, lang, decision, scenarioId, applyScenario, patch, analyze, loading } = useSolar();
  const ar = lang === "ar";
  return <>
    <div className="page-heading"><div><h1>{ar ? "محاكي الطاقة" : "Energy Simulator"}</h1><p>{ar ? "مدخلات افتراضية، حسابات فعلية، وتوصيات استرشادية." : "Simulated inputs, calculated power balance, advisory decisions."}</p></div><span className="badge">{ar ? "محاكاة فقط" : "Simulation only"}</span></div>
    <fieldset className="scenario-picker"><legend>{ar ? "السيناريو" : "Scenario"}</legend><div className="scenario-options">{SCENARIOS.map(scenario => <label key={scenario.id} className={scenarioId === scenario.id ? "scenario selected" : "scenario"}><input type="radio" name="scenario" checked={scenarioId === scenario.id} onChange={() => applyScenario(scenario.id)} /><span><strong>{ar ? scenario.nameAr : scenario.nameEn}</strong><small>{ar ? scenario.descAr : scenario.descEn}</small></span></label>)}</div>{!scenarioId && <p className="small muted">{ar ? "قيم مخصصة" : "Custom values"}</p>}</fieldset>
    <div className="simulator-grid"><SimulationControls sim={sim} onChange={patch} onAnalyze={analyze} loading={loading} lang={lang} /><div className="simulator-results"><EnergyOverview calc={calc} batteryLevelPct={sim.batteryLevelPct} lang={lang} /><EnergyFlow calc={calc} batteryLevelPct={sim.batteryLevelPct} batteryCapacityWh={sim.batteryCapacityWh} active={decision.recommendedAction} lang={lang} /><AIRecommendation /></div></div>
  </>;
}
