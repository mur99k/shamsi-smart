"use client";

import { useState } from "react";
import { Play, LoaderCircle, FlaskConical, Info, Check, X } from "lucide-react";
import { RECOMMENDED_ACTIONS, type DecisionRequest, type RecommendedAction } from "@/types/energy";
import { fallbackDecide } from "@/lib/ai/fallback";
import { buildDecisionRequest } from "@/lib/energy/scenarios";
import { useSolar } from "./SolarProvider";
import type { Lang } from "./lang";

interface Case {
  nameAr: string;
  nameEn: string;
  body: DecisionRequest;
  expected: RecommendedAction;
}

const CASES: Case[] = [
  {
    nameAr: "نهار مشمس وبطارية منخفضة",
    nameEn: "Sunny day, low battery",
    body: {
      solarProductionW: 1000, consumptionW: 300, excessEnergyW: 700,
      battery: { available: true, capacityWh: 5000, levelPercent: 40 },
      ev: { available: true, charging: false },
      loads: { available: true, totalCapacityW: 800 },
      environment: { currentTime: "2026-09-16T12:00:00+03:00", estimatedSolarProductionNextHourW: 900 },
    },
    expected: "battery_storage",
  },
  {
    nameAr: "إنتاج أقصى وبطارية ممتلئة (شحن سيارة)",
    nameEn: "Peak output, full battery (EV charging)",
    body: {
      solarProductionW: 1000, consumptionW: 300, excessEnergyW: 700,
      battery: { available: true, capacityWh: 5000, levelPercent: 90 },
      ev: { available: true, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "ev_charging",
  },
  {
    nameAr: "فائض طاقة (أحمال إضافية)",
    nameEn: "Energy surplus (extra loads)",
    body: {
      solarProductionW: 1000, consumptionW: 300, excessEnergyW: 700,
      battery: { available: true, capacityWh: 5000, levelPercent: 95 },
      ev: { available: false, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "additional_load",
  },
  {
    nameAr: "عجز طاقة واستهلاك مرتفع",
    nameEn: "Energy deficit, high demand",
    body: {
      solarProductionW: 300, consumptionW: 700, excessEnergyW: 0,
      battery: { available: true, capacityWh: 5000, levelPercent: 60 },
      ev: { available: false, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "energy_shortage",
  },
  {
    nameAr: "توازن النظام واستقراره",
    nameEn: "System balance and stability",
    body: {
      solarProductionW: 500, consumptionW: 500, excessEnergyW: 0,
      battery: { available: true, capacityWh: 5000, levelPercent: 60 },
      ev: { available: true, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "no_action",
  },
];

/** Display labels for decisions — presentation only, logic still uses the raw action keys. */
const ACTION_LABEL: Record<RecommendedAction, { ar: string; en: string }> = {
  battery_storage: { ar: "تخزين في البطارية 🔋", en: "Battery storage 🔋" },
  ev_charging: { ar: "شحن المركبة الكهربائية 🚗", en: "Electric vehicle charging 🚗" },
  additional_load: { ar: "تشغيل الأحمال الإضافية 💡", en: "Running extra loads 💡" },
  reduce_solar_input: { ar: "تقليل الإدخال الشمسي 🔻", en: "Reducing solar input 🔻" },
  no_action: { ar: "حالة توازن واستقرار ✅", en: "Balanced and stable ✅" },
  energy_shortage: { ar: "إدارة عجز الطاقة ⚠️", en: "Managing energy shortage ⚠️" },
};

interface Row {
  index: number;
  expected: RecommendedAction;
  actual: RecommendedAction | null;
  match: boolean;
  source: "ai" | "fallback" | "error";
}

/**
 * EVALUATION — runs the 5 scripted cases against POST /api/ai/decision
 * and reports measured outcomes only. Anything unmeasured is "Not measured".
 * Model confidence is model-reported, NOT scientific accuracy.
 */
export default function EvaluationRunner({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  const { sim } = useSolar();
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(0);
  const [live, setLive] = useState<{ action: RecommendedAction | null; summary: string } | null>(null);
  const [liveRunning, setLiveRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: Row[] = [];
    for (let i = 0; i < CASES.length; i++) {
      const c = CASES[i];
      try {
        const res = await fetch("/api/ai/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c.body),
        });
        const data = await res.json();
        const actual =
          res.ok && RECOMMENDED_ACTIONS.includes(data?.decision?.recommendedAction)
            ? (data.decision.recommendedAction as RecommendedAction)
            : null;
        out.push({
          index: i, expected: c.expected, actual,
          match: actual === c.expected,
          source: data?.source === "ai" ? "ai" : res.ok ? "fallback" : "error",
        });
      } catch {
        out.push({ index: i, expected: c.expected, actual: null, match: false, source: "error" });
      }
      setRows([...out]);
    }
    setRunning(false);
  };

  const done = rows.length === CASES.length && !running;
  const valid = rows.filter((r) => r.actual !== null).length;
  const matches = rows.filter((r) => r.match).length;
  const matchRate = rows.length === CASES.length ? Math.round((matches / CASES.length) * 100) : null;
  const localOf = (c: Case) => fallbackDecide(c.body).recommendedAction;
  const label = (a: RecommendedAction) => (ar ? ACTION_LABEL[a].ar : ACTION_LABEL[a].en);

  const runLive = async () => {
    setLiveRunning(true);
    setLive(null);
    const body = buildDecisionRequest(sim);
    const summary = `${body.solarProductionW}W / ${body.consumptionW}W / ${body.battery.levelPercent}%`;
    try {
      const res = await fetch("/api/ai/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const action =
        res.ok && RECOMMENDED_ACTIONS.includes(data?.decision?.recommendedAction)
          ? (data.decision.recommendedAction as RecommendedAction)
          : fallbackDecide(body).recommendedAction;
      setLive({ action, summary });
    } catch {
      setLive({ action: fallbackDecide(body).recommendedAction, summary });
    }
    setLiveRunning(false);
  };

  const hero = (labelText: string, value: string, sub: string) => (
    <div className="hero-card"><dt>{labelText}</dt><dd className="num" dir="ltr">{value}</dd><span>{sub}</span></div>
  );
  const tip = ar
    ? "توافق السلوك يعني تطابق القرار الفعلي مع المتوقع في هذه الحالات الخمس فقط — وليس دقة علمية عامة"
    : "Behavior match means the actual decision equaled the expected one in these five cases only — not general scientific accuracy";

  return (
    <section className="section evaluation" aria-busy={running}>
      <div className="section-heading"><h2>{ar ? "اختبارات النظام" : "System tests"}</h2><button onClick={run} disabled={running} className="button primary">{running ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}{running ? (ar ? "جارٍ التشغيل..." : "Running...") : (ar ? "تشغيل الاختبارات" : "Run tests")}</button></div>

      <dl className="hero-metrics">
        {hero(ar ? "توافق السلوك البرمجي" : "Behavioral match", matchRate !== null ? `${matchRate}%` : "—", ar ? "من هذا التشغيل فقط، وليست دقة علمية" : "This run only, not scientific accuracy")}
        {hero(ar ? "استجابات مستلمة" : "Responses received", rows.length ? `${valid} / ${CASES.length}` : "—", ar ? "قرارات صالحة في هذا التشغيل" : "Valid decisions this run")}
        {hero(ar ? "وفورات الطاقة" : "Energy savings", ar ? "لم تُقَس" : "Not measured", ar ? "تتطلب قياس Wh ومقارنة بخط أساس" : "Requires Wh metering vs a baseline")}
      </dl>

      <div className="match-wrap">
        <div className="match-head"><span>{ar ? "توافق السلوك" : "Behavior match"} <span className="tip" title={tip}>✨</span></span><span className="num" dir="ltr">{matchRate !== null ? `${matchRate}%` : "—"}</span></div>
        <div className="match-bar" role="img" aria-label={ar ? `توافق السلوك ${matchRate ?? 0} بالمئة` : `Behavior match ${matchRate ?? 0} percent`}>
          <div className="match-fill" style={{ width: `${matchRate ?? 0}%` }} />
        </div>
      </div>
      <div role="status" className="evaluation-status">{running ? `${rows.length} / ${CASES.length}` : done ? (ar ? "اكتمل التشغيل" : "Run complete") : (ar ? "لم يتم القياس" : "Not measured")}</div>

      <h3 className="eval-cards-title">{ar ? "السيناريوهات المختبرة" : "Tested scenarios"}</h3>
      <div className="scenario-cards">
        {CASES.map((c, i) => {
          const row = rows[i];
          return (
            <button key={i} type="button" onClick={() => setSelected(i)} aria-pressed={selected === i} className={selected === i ? "scenario-card selected" : "scenario-card"}>
              <span className="scenario-num" dir="ltr">{i + 1}</span>
              <strong>{ar ? c.nameAr : c.nameEn}</strong>
              <small>{ar ? "المتوقع" : "Expected"}: {label(c.expected)}</small>
              <small>{ar ? "النظام يقترح" : "System suggests"}: {label(localOf(c))}</small>
              {row && (
                <span className={row.match ? "scenario-verdict ok" : "scenario-verdict no"}>
                  {row.match ? <Check size={14} /> : <X size={14} />}
                  {row.actual ? label(row.actual) : (ar ? "غير متاح" : "Unavailable")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={ar ? "نتائج الاختبارات" : "Test results"}>
          <table><caption>{ar ? "مقارنة القرار المتوقع بالفعلي" : "Expected versus actual decisions"}</caption><thead><tr>{(ar ? ["الحالة", "القرار المتوقع", "قرار النظام", "النتيجة"] : ["Case", "Expected decision", "System decision", "Result"]).map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(row => (
            <tr key={row.index}><th scope="row">{ar ? CASES[row.index].nameAr : CASES[row.index].nameEn}</th><td>{label(row.expected)}</td><td>{row.actual ? label(row.actual) : (ar ? "غير متاح" : "Unavailable")}</td><td>{row.match ? (ar ? "مطابق ✅" : "Match ✅") : (ar ? "غير مطابق ⚠️" : "Mismatch ⚠️")}</td></tr>
          ))}</tbody></table>
        </div>
      )}

      <div className="eval-extra">
        <div className="eval-live">
          <h3>{ar ? "اختبار الحالة الحالية من المحاكي" : "Test live simulator state"}</h3>
          <button onClick={runLive} disabled={liveRunning} className="button"><FlaskConical size={17} />{liveRunning ? (ar ? "جارٍ الاختبار..." : "Testing...") : (ar ? "اختبار الحالة الحية" : "Test live state")}</button>
          {live && <p role="status" className="eval-live-ok"><span dir="ltr" className="num">{live.summary}</span> ← {live.action ? label(live.action) : (ar ? "غير متاح" : "Unavailable")}</p>}
        </div>
      </div>

      <p className="small muted"><Info size={13} /> {tip}</p>
    </section>
  );
}
