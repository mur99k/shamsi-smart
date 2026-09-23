"use client";

import { useState, type CSSProperties } from "react";
import { LOAD_PRESETS, type SimState } from "@/lib/energy/scenarios";
import type { Lang } from "./lang";

export function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  return <div className="control-row"><div className="control-label"><span>{label}</span><label className="numeric-field" dir="ltr"><input lang="en" aria-label={`${label} exact value`} type="number" min={min} max={max} step={1} value={editing ? draft : value}
    onFocus={() => { setEditing(true); setDraft(String(value)); }}
    onChange={event => {
      const raw = event.target.value;
      setDraft(raw);
      if (raw !== "" && Number.isFinite(Number(raw))) onChange(Math.min(max, Math.max(min, Math.round(Number(raw)))));
    }}
    onBlur={() => setEditing(false)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span>{unit}</span></label></div>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} style={{ "--fill": `${max > min ? Math.round(((value - min) / (max - min)) * 100) : 0}%` } as CSSProperties} onChange={event => { setEditing(false); onChange(Number(event.target.value)); }} />
  </div>;
}

export default function SimulationControls({ sim, onChange, onAnalyze, loading, lang }: {
  sim: SimState; onChange: (patch: Partial<SimState>) => void; onAnalyze: () => void; loading: boolean; lang: Lang;
}) {
  const ar = lang === "ar";
  type FieldKey = keyof Pick<SimState, "solarProductionW" | "consumptionW" | "batteryLevelPct" | "batteryCapacityWh" | "futureSolarEstimateW">;
  type Field = [FieldKey, string, number, number, number, string];
  const prodFields: Field[] = [
    ["solarProductionW", ar ? "إنتاج الطاقة" : "Solar production", 0, 2000, 50, "W"],
    ["consumptionW", ar ? "الاستهلاك الحالي" : "Consumption", 0, 2000, 50, "W"],
    ["futureSolarEstimateW", ar ? "توقع الإنتاج القادم" : "Expected solar ahead", 0, 2000, 50, "W"],
  ];
  const deviceFields: Field[] = [
    ["batteryLevelPct", ar ? "مستوى البطارية" : "Battery level", 0, 100, 1, "%"],
    ["batteryCapacityWh", ar ? "سعة البطارية" : "Battery capacity", 0, 15000, 500, "Wh"],
  ];
  return <section className="section sim-inputs"><h2>{ar ? "مدخلات المحاكاة" : "Simulation inputs"}</h2>
    <details className="acc" open><summary>{ar ? "☀️ سيناريو الإنتاج" : "☀️ Production scenario"}</summary>
      <div className="controls">{prodFields.map(([key, label, min, max, step, unit]) => <Slider key={key} label={label} value={sim[key]} min={min} max={max} step={step} unit={unit} onChange={value => onChange({ [key]: value })} />)}</div>
      <label className="time-field">{ar ? "الوقت الحالي" : "Current time"}<input type="time" value={sim.currentTime} onChange={event => { if (event.target.value) onChange({ currentTime: event.target.value }); }} /></label>
    </details>
    <details className="acc" open><summary>{ar ? "🔌 الأجهزة والأحمال" : "🔌 Devices & loads"}</summary>
      <div className="controls">{deviceFields.map(([key, label, min, max, step, unit]) => <Slider key={key} label={label} value={sim[key]} min={min} max={max} step={step} unit={unit} onChange={value => onChange({ [key]: value })} />)}</div>
      <fieldset><legend>{ar ? "الأجهزة المتاحة" : "Device availability"}</legend>
        <label className="check-row"><input type="checkbox" checked={sim.batteryAvailable} onChange={event => onChange({ batteryAvailable: event.target.checked })} /><span>{ar ? "البطارية متصلة" : "Battery connected"}</span></label>
        <label className="check-row"><input type="checkbox" checked={sim.evAvailable} onChange={event => onChange({ evAvailable: event.target.checked })} /><span>{ar ? "السيارة الكهربائية متاحة" : "EV available"}</span></label>
        <label className="check-row"><input type="checkbox" checked={sim.evCharging} disabled={!sim.evAvailable} onChange={event => onChange({ evCharging: event.target.checked })} /><span>{ar ? "السيارة قيد الشحن" : "EV already charging"}</span></label>
      </fieldset>
      <fieldset><legend>{ar ? "الأحمال المتاحة" : "Available loads"}</legend><div className="load-options">{LOAD_PRESETS.map((load) => <label key={load.id} className="check-row"><input type="checkbox" checked={sim.availableLoads.includes(load.id)} onChange={event => onChange({ availableLoads: event.target.checked ? [...sim.availableLoads, load.id] : sim.availableLoads.filter(item => item !== load.id) })} /><span>{ar ? `${load.ar} (${load.watts} واط)` : `${load.en} (${load.watts} W)`}</span></label>)}</div>
        <p className="small muted">{ar ? "قيم استرشادية للمحاكاة، وليست قياسات فعلية." : "Example draws for simulation, not real measurements."}</p></fieldset>
    </details>
    <button className="button primary" onClick={onAnalyze} disabled={loading}>{loading ? (ar ? "جارٍ التحليل..." : "Analyzing...") : (ar ? "تحليل الحالة" : "Analyze state")}</button>
  </section>;
}
