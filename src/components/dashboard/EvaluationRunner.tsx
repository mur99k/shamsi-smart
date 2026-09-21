"use client";

import { useState } from "react";
import { Play, LoaderCircle, Zap, Activity, FlaskConical, Info } from "lucide-react";
import { RECOMMENDED_ACTIONS, type DecisionRequest, type RecommendedAction } from "@/types/energy";
import { fallbackDecide } from "@/lib/ai/fallback";
import { buildDecisionRequest } from "@/lib/energy/scenarios";
import { useSolar } from "./SolarProvider";
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

interface HistoryRun {
  at: string;
  matches: number;
  avg: number;
  ai: number;
  localMs: number;
}

const HISTORY_KEY = "solar-eval-history-v1";

function loadHistory(): HistoryRun[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, 3) : [];
  } catch {
    return [];
  }
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
  const [stress, setStress] = useState<{ ok: number; ms: number } | null>(null);
  const [stressRunning, setStressRunning] = useState(false);
  const [quick, setQuick] = useState(0);
  const [localMs, setLocalMs] = useState<number | null>(null);
  const [live, setLive] = useState<{ action: RecommendedAction | null; source: string; ms: number; summary: string } | null>(null);
  const [liveRunning, setLiveRunning] = useState(false);
  const [history, setHistory] = useState<HistoryRun[]>(() => loadHistory());

  const run = async () => {
    setRunning(true);
    const out: Row[] = [];
    // Local engine timing, measured in-browser with no network involved.
    const lt0 = performance.now();
    for (const c of CASES) fallbackDecide(c.body);
    const localMs = Math.max(1, Math.round((performance.now() - lt0) / CASES.length));
    setLocalMs(localMs);
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
    const matches = out.filter((r) => r.match).length;
    const aiRows = out.filter((r) => r.source === "ai");
    const avg = out.length ? Math.round(out.reduce((a, r) => a + r.ms, 0) / out.length) : 0;
    const entry: HistoryRun = {
      at: new Date().toLocaleTimeString(),
      matches,
      avg,
      ai: aiRows.length ? Math.round(aiRows.reduce((a, r) => a + r.ms, 0) / aiRows.length) : 0,
      localMs,
    };
    const next = [entry, ...history].slice(0, 3);
    setHistory(next);
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* session storage unavailable — history stays in memory */ }
    setRunning(false);
  };

  const done = rows.length === CASES.length && !running;
  const valid = rows.filter((r) => r.actual !== null).length;
  const fallbacks = rows.filter((r) => r.source === "fallback").length;
  const invalid = rows.filter((r) => r.actual === null).length;
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) : null;
  const aiRows = rows.filter((r) => r.source === "ai");
  const avgAi = aiRows.length ? Math.round(aiRows.reduce((a, r) => a + r.ms, 0) / aiRows.length) : null;
  const matches = rows.filter((r) => r.match).length;
  const matchRate = rows.length === CASES.length ? Math.round((matches / CASES.length) * 100) : null;
  const localOf = (c: Case) => fallbackDecide(c.body).recommendedAction;

  const runLive = async () => {
    setLiveRunning(true);
    setLive(null);
    const body = buildDecisionRequest(sim);
    const summary = `${body.solarProductionW}W / ${body.consumptionW}W / ${body.battery.levelPercent}%`;
    const t0 = performance.now();
    try {
      const res = await fetch("/api/ai/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      const action =
        res.ok && RECOMMENDED_ACTIONS.includes(data?.decision?.recommendedAction)
          ? (data.decision.recommendedAction as RecommendedAction)
          : null;
      setLive({ action, source: data?.source === "ai" ? "ai" : res.ok ? "fallback" : "error", ms, summary });
    } catch {
      const fb = fallbackDecide(body);
      setLive({ action: fb.recommendedAction, source: "fallback", ms: Math.round(performance.now() - t0), summary });
    }
    setLiveRunning(false);
  };

  const stressTest = async () => {
    setStressRunning(true);
    setStress(null);
    const t0 = performance.now();
    let ok = 0;
    for (const c of CASES) {
      // Simulated disconnect: abort before any byte leaves, then answer locally.
      const controller = new AbortController();
      controller.abort();
      try {
        await fetch("/api/ai/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c.body),
          signal: controller.signal,
        });
      } catch {
        const fb = fallbackDecide(c.body);
        if (RECOMMENDED_ACTIONS.includes(fb.recommendedAction)) ok += 1;
      }
    }
    setStress({ ok, ms: Math.round(performance.now() - t0) });
    setStressRunning(false);
  };

  const hero = (label: string, value: string, sub: string) => (
    <div className="hero-card"><dt>{label}</dt><dd className="num" dir="ltr">{value}</dd><span>{sub}</span></div>
  );
  const tip = ar
    ? "توافق السلوك يعني تطابق القرار الفعلي مع المتوقع في هذه الحالات الخمس فقط — وليس دقة علمية عامة"
    : "Behavior match means the actual decision equaled the expected one in these five cases only — not general scientific accuracy";

  return (
    <section className="section evaluation" aria-busy={running}>
      <div className="section-heading"><h2>{ar ? "اختبارات API" : "API test runner"}</h2><button onClick={run} disabled={running} className="button primary">{running ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}{running ? (ar ? "جارٍ التشغيل..." : "Running...") : (ar ? "تشغيل الاختبارات" : "Run tests")}</button></div>
      <p className="muted">{ar ? "حالات ثابتة مستقلة عن المحاكاة الحالية. مغادرة الصفحة تعيد ضبط عرض النتائج." : "Fixed cases independent of the current simulation. Leaving this page resets the result display."}</p>
      <dl className="hero-metrics">
        {hero(ar ? "توافق السلوك البرمجي" : "Behavioral match", matchRate !== null ? `${matchRate}%` : "—", ar ? "من هذا التشغيل فقط، وليست دقة علمية" : "This run only, not scientific accuracy")}
        {hero(ar ? "زمن AI عبر الخادم" : "AI server latency", avgAi !== null ? `${avgAi} ms` : "—", ar ? "متوسط الصفوف التي أجاب عنها النموذج" : "Average of rows answered by the model")}
        {hero(ar ? "زمن القواعد المحلية" : "Local engine latency", localMs !== null ? `${localMs} ms` : "—", ar ? "مقاس في المتصفح دون شبكة" : "Measured in-browser, no network")}
        {hero(ar ? "استجابات مستلمة" : "Responses received", rows.length ? `${valid} / ${CASES.length}` : "—", ar ? "قرارات صالحة في هذا التشغيل" : "Valid decisions this run")}
        {hero(ar ? "وفورات الطاقة" : "Energy savings", ar ? "لم تُقَس" : "Not measured", ar ? "تتطلب قياس Wh ومقارنة بخط أساس" : "Requires Wh metering vs a baseline")}
      </dl>
      <div className="match-wrap">
        <div className="match-head"><span>{ar ? "توافق السلوك" : "Behavior match"} <span className="tip" title={tip}>✨</span></span><span className="num" dir="ltr">{matchRate !== null ? `${matchRate}%` : "—"}</span></div>
        <div className="match-bar" role="img" aria-label={ar ? `توافق السلوك ${matchRate ?? 0} بالمئة` : `Behavior match ${matchRate ?? 0} percent`}>
          <div className="match-fill" style={{ width: `${matchRate ?? 0}%` }} />
        </div>
        {rows.length > 0 && <div className="latency-timeline">{rows.map(r => {
          const max = Math.max(...rows.map(x => x.ms), 1);
          return <div key={r.name} className="latency-row"><span dir="ltr">{r.name.split("·")[0].trim()}</span><div className="latency-track"><div className="latency-fill" style={{ width: `${Math.max(4, Math.round((r.ms / max) * 100))}%` }} /></div><span className="num" dir="ltr">{r.ms} ms</span></div>;
        })}</div>}
      </div>
      <div role="status" className="evaluation-status">{running ? `${rows.length} / ${CASES.length}` : done ? (ar ? "اكتمل التشغيل" : "Run complete") : (ar ? "لم يتم القياس" : "Not measured")}</div>
      {history.length > 0 && <div className="history-log"><h3>{ar ? "سجل الجلسة (آخر 3 تشغيلات)" : "Session history (last 3 runs)"}</h3><ul>{history.map((h, i) => <li key={i} dir="ltr" className="num">{h.at} · {h.matches}/{CASES.length} · {h.avg} ms</li>)}</ul></div>}
      {rows.length > 0 && <>
        <dl className="evaluation-metrics">{[
          [ar ? "الاختبارات" : "Tests", rows.length], [ar ? "قرارات صالحة" : "Valid", valid],
          [ar ? "احتياطي" : "Fallback", fallbacks], [ar ? "غير صالحة" : "Invalid", invalid],
          [ar ? "متوسط الزمن" : "Average time", `${avg} ms`],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={ar ? "نتائج الاختبارات" : "Test results"}><table><caption>{ar ? "مقارنة القرار المتوقع بالفعلي" : "Expected versus actual decisions"}</caption><thead><tr>{(ar ? ["الحالة", "المتوقع", "القواعد المحلية", "محرك AI", "المصدر", "الزمن", "التوافق"] : ["Case", "Expected", "Rule-Based", "AI Engine", "Source", "Time", "Match"]).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(row => { const c = CASES.find(x => x.name === row.name)!; const local = localOf(c); return <tr key={row.name}><th scope="row" dir="ltr">{row.name}</th><td>{row.expected}</td><td>{local}</td><td>{row.actual ?? (ar ? "غير متاح" : "Unavailable")}</td><td>{row.source}</td><td dir="ltr">{row.ms} ms</td><td>{row.match ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</td></tr>; })}</tbody></table></div>
      </>}
      <div className="eval-extra">
        <div className="eval-live">
          <h3>{ar ? "اختبار الحالة الحالية من المحاكي" : "Test live simulator state"}</h3>
          <p className="small muted">{ar ? "يرسل قراءات المحاكاة الحية الآن كحالة إضافية خارج الجدول الثابت." : "Sends the current live simulator readings as an extra case outside the fixed table."}</p>
          <button onClick={runLive} disabled={liveRunning} className="button"><FlaskConical size={17} />{liveRunning ? (ar ? "جارٍ الاختبار..." : "Testing...") : (ar ? "اختبار الحالة الحية" : "Test live state")}</button>
          {live && <p role="status" className="eval-live-ok" dir="ltr">{live.summary} → {live.action ?? "error"} · {live.source} · {live.ms} ms</p>}
        </div>
        <div className="eval-try">
          <h3>{ar ? "تجربة سيناريو سريع" : "Try a quick scenario"}</h3>
          <div className="eval-try-row">
            <select aria-label={ar ? "اختر حالة" : "Choose a case"} value={quick} onChange={e => setQuick(Number(e.target.value))}>
              {CASES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
            </select>
            <span className="badge" dir="ltr">{ar ? "القواعد" : "Rules"}: {localOf(CASES[quick])}</span>
            <span className="badge" dir="ltr">{ar ? "المتوقع" : "Expected"}: {CASES[quick].expected}</span>
          </div>
          <p className="small muted">{ar ? "القواعد المحلية تُحسب فورًا في المتصفح دون شبكة؛ عمود محرك AI يمتلئ بعد تشغيل الاختبارات." : "Local rules compute instantly in the browser with no network; the AI Engine column fills after running the tests."}</p>
        </div>
        <div className="eval-stress">
          <h3>{ar ? "اختبار الجاهزية والـ Fallback" : "Readiness & fallback test"}</h3>
          <p className="small muted">{ar ? "يحاكي انقطاع الخادم بإلغاء الطلبات قبل إرسالها، ثم يتحقق أن المحرك المحلي يجيب على الحالات الخمس." : "Simulates a server outage by aborting requests before they leave, then verifies the local engine answers all five cases."}</p>
          <button onClick={stressTest} disabled={stressRunning} className="button"><Zap size={17} />{stressRunning ? (ar ? "جارٍ الاختبار..." : "Testing...") : (ar ? "اختبار الجاهزية" : "Test readiness")}</button>
          {stress && <p role="status" className="eval-stress-ok"><Activity size={16} />{ar ? `Fallback نشط — أجاب المحرك المحلي عن ${stress.ok} / ${CASES.length} في ${stress.ms}ms (انقطاع مُحاكى)` : `Fallback active — local engine answered ${stress.ok} / ${CASES.length} in ${stress.ms}ms (simulated outage)`}</p>}
        </div>
      </div>
      <p className="small muted">{ar ? "المطابقة إرشادية. ثقة النموذج ليست دقة علمية مقاسة، ولا تثبت هذه الاختبارات وفورات حقيقية." : "Expected matches are advisory. Model confidence is not measured accuracy, and these tests do not establish real savings."}</p>
      <p className="small muted"><Info size={13} /> {tip}</p>
    </section>
  );
}
