"use client";

import { useState } from "react";
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
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => { setEditing(false); onChange(Number(event.target.value)); }} />
  </div>;
}

export default function SimulationControls({ sim, onChange, onAnalyze, loading, lang }: {
  sim: SimState; onChange: (patch: Partial<SimState>) => void; onAnalyze: () => void; loading: boolean; lang: Lang;
}) {
  const ar = lang === "ar";
  const fields: [keyof Pick<SimState, "solarProductionW" | "consumptionW" | "batteryLevelPct" | "batteryCapacityWh" | "futureSolarEstimateW">, string, number, number, number, string][] = [
    ["solarProductionW", ar ? "إنتاج الطاقة" : "Solar production", 0, 2000, 50, "W"],
    ["consumptionW", ar ? "الاستهلاك الحالي" : "Consumption", 0, 2000, 50, "W"],
    ["batteryLevelPct", ar ? "مستوى البطارية" : "Battery level", 0, 100, 1, "%"],
    ["batteryCapacityWh", ar ? "سعة البطارية" : "Battery capacity", 0, 15000, 500, "Wh"],
    ["futureSolarEstimateW", ar ? "توقع الإنتاج القادم" : "Expected solar ahead", 0, 2000, 50, "W"],
  ];
  const loadAr = ["سخان المياه", "مكيف", "غسالة", "مضخة مياه", "مدفأة", "إضاءة"];
  return <section className="section"><h2>{ar ? "مدخلات المحاكاة" : "Simulation inputs"}</h2>
    <div className="controls">{fields.map(([key, label, min, max, step, unit]) => <Slider key={key} label={label} value={sim[key]} min={min} max={max} step={step} unit={unit} onChange={value => onChange({ [key]: value })} />)}</div>
    <label className="time-field">{ar ? "الوقت الحالي" : "Current time"}<input type="time" value={sim.currentTime} onChange={event => { if (event.target.value) onChange({ currentTime: event.target.value }); }} /></label>
    <fieldset><legend>{ar ? "الأجهزة المتاحة" : "Device availability"}</legend>
      <label className="check-row"><input type="checkbox" checked={sim.batteryAvailable} onChange={event => onChange({ batteryAvailable: event.target.checked })} />{ar ? "البطارية متصلة" : "Battery connected"}</label>
      <label className="check-row"><input type="checkbox" checked={sim.evAvailable} onChange={event => onChange({ evAvailable: event.target.checked })} />{ar ? "السيارة الكهربائية متاحة" : "EV available"}</label>
      <label className="check-row"><input type="checkbox" checked={sim.evCharging} disabled={!sim.evAvailable} onChange={event => onChange({ evCharging: event.target.checked })} />{ar ? "السيارة قيد الشحن" : "EV already charging"}</label>
    </fieldset>
    <fieldset><legend>{ar ? "الأحمال المتاحة" : "Available loads"}</legend><div className="load-options">{LOAD_PRESETS.map((load, i) => <label key={load} className="check-row"><input type="checkbox" checked={sim.availableLoads.includes(load)} onChange={event => onChange({ availableLoads: event.target.checked ? [...sim.availableLoads, load] : sim.availableLoads.filter(item => item !== load) })} />{ar ? loadAr[i] : load}</label>)}</div></fieldset>
    <button className="button primary" onClick={onAnalyze} disabled={loading}>{loading ? (ar ? "جارٍ التحليل..." : "Analyzing...") : (ar ? "تحليل الحالة" : "Analyze state")}</button>
  </section>;
}
