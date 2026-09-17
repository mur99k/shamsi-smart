"use client";

import { useState } from "react";
import { Play, LoaderCircle } from "lucide-react";
import { RECOMMENDED_ACTIONS, type DecisionRequest, type RecommendedAction } from "@/types/energy";
import type { Lang } from "./lang";

interface Case {
  name: string;
  body: DecisionRequest;
  expected: RecommendedAction;
}

const CASES: Case[] = [
  {
    name: "Test 01 · Solar 1000 / Load 300 / Batt 40%",
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
    name: "Test 02 · Solar 1000 / Load 300 / Batt 90% / EV",
    body: {
      solarProductionW: 1000, consumptionW: 300, excessEnergyW: 700,
      battery: { available: true, capacityWh: 5000, levelPercent: 90 },
      ev: { available: true, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "ev_charging",
  },
  {
    name: "Test 03 · Solar 1000 / Load 300 / Batt 95% / No EV / Loads",
    body: {
      solarProductionW: 1000, consumptionW: 300, excessEnergyW: 700,
      battery: { available: true, capacityWh: 5000, levelPercent: 95 },
      ev: { available: false, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "additional_load",
  },
  {
    name: "Test 04 · Solar 300 / Load 700 (shortage)",
    body: {
      solarProductionW: 300, consumptionW: 700, excessEnergyW: 0,
      battery: { available: true, capacityWh: 5000, levelPercent: 60 },
      ev: { available: false, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "energy_shortage",
  },
  {
    name: "Test 05 · Solar 500 / Load 500 (balanced)",
    body: {
      solarProductionW: 500, consumptionW: 500, excessEnergyW: 0,
      battery: { available: true, capacityWh: 5000, levelPercent: 60 },
      ev: { available: true, charging: false },
      loads: { available: true, totalCapacityW: 800 },
    },
    expected: "no_action",
  },
];

interface Row {
  name: string;
  expected: RecommendedAction;
  actual: RecommendedAction | null;
  match: boolean;
  source: "ai" | "fallback" | "error";
  ms: number;
}

/**
 * EVALUATION — runs the 5 scripted cases against POST /api/ai/decision
 * and reports measured outcomes only. Anything unmeasured is "Not measured".
 * Model confidence is model-reported, NOT scientific accuracy.
 */
export default function EvaluationRunner({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: Row[] = [];
    for (const c of CASES) {
      const t0 = performance.now();
      try {
        const res = await fetch("/api/ai/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c.body),
        });
        const ms = Math.round(performance.now() - t0);
        const data = await res.json();
        const actual =
          res.ok && RECOMMENDED_ACTIONS.includes(data?.decision?.recommendedAction)
            ? (data.decision.recommendedAction as RecommendedAction)
            : null;
        out.push({
          name: c.name, expected: c.expected, actual,
          match: actual === c.expected,
          source: data?.source === "ai" ? "ai" : res.ok ? "fallback" : "error",
          ms,
        });
      } catch {
        out.push({ name: c.name, expected: c.expected, actual: null, match: false, source: "error", ms: 0 });
      }
      setRows([...out]);
    }
    setRunning(false);
  };

  const done = rows.length === CASES.length && !running;
  const valid = rows.filter((r) => r.actual !== null).length;
  const fallbacks = rows.filter((r) => r.source === "fallback").length;
  const invalid = rows.filter((r) => r.actual === null).length;
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) : null;

  return (
    <section className="section evaluation" aria-busy={running}>
      <div className="section-heading"><h2>{ar ? "اختبارات API" : "API test runner"}</h2><button onClick={run} disabled={running} className="button primary">{running ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}{running ? (ar ? "جارٍ التشغيل..." : "Running...") : (ar ? "تشغيل الاختبارات" : "Run tests")}</button></div>
      <p className="muted">{ar ? "حالات ثابتة مستقلة عن المحاكاة الحالية. مغادرة الصفحة تعيد ضبط عرض النتائج." : "Fixed cases independent of the current simulation. Leaving this page resets the result display."}</p>
      <div role="status" className="evaluation-status">{running ? `${rows.length} / ${CASES.length}` : done ? (ar ? "اكتمل التشغيل" : "Run complete") : (ar ? "لم يتم القياس" : "Not measured")}</div>
      {rows.length > 0 && <>
        <dl className="evaluation-metrics">{[
          [ar ? "الاختبارات" : "Tests", rows.length], [ar ? "قرارات صالحة" : "Valid", valid],
          [ar ? "احتياطي" : "Fallback", fallbacks], [ar ? "غير صالحة" : "Invalid", invalid],
          [ar ? "متوسط الزمن" : "Average time", `${avg} ms`],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={ar ? "نتائج الاختبارات" : "Test results"}><table><caption>{ar ? "مقارنة القرار المتوقع بالفعلي" : "Expected versus actual decisions"}</caption><thead><tr>{(ar ? ["الحالة", "المتوقع", "الفعلي", "المصدر", "الزمن", "مطابقة"] : ["Case", "Expected", "Actual", "Source", "Time", "Match"]).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.name}><th scope="row" dir="ltr">{row.name}</th><td>{row.expected}</td><td>{row.actual ?? (ar ? "غير متاح" : "Unavailable")}</td><td>{row.source}</td><td dir="ltr">{row.ms} ms</td><td>{row.match ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</td></tr>)}</tbody></table></div>
      </>}
      <p className="small muted">{ar ? "المطابقة إرشادية. ثقة النموذج ليست دقة علمية مقاسة، ولا تثبت هذه الاختبارات وفورات حقيقية." : "Expected matches are advisory. Model confidence is not measured accuracy, and these tests do not establish real savings."}</p>
    </section>
  );
}
