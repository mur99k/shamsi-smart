# ملحق الكود — لوحة التحكم الحية

> **مولَّد آليًا** من الملفات الفعلية عند commit `45fb051` — لا تعدّله يدويًا.
> لإعادة التوليد: `node scripts/gen-dashboard-code.mjs`
>
> الغرض: تسليم كود المكوّنات والصفحات كما هو في المستودع، دون نسخ يدوي.
> الشرح المعماري في `docs/DASHBOARD.md`، وتقرير المطابقة في `docs/REPORT-FOR-MARIA.md`.

---

## `src/app/dashboard/page.tsx`

الصفحة التي تجمع اللوحة الحية مع قسم المحاكاة

```tsx
import DashboardScreen from "@/components/dashboard/DashboardScreen";
import LiveDashboard from "@/components/dashboard/LiveDashboard";

export const metadata = {
  title: "Dashboard — SolarWise Decision Prototype",
  description: "Current simulated energy balance and advisory recommendation.",
};

export default function DashboardPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>لوحة التحكم الحية</h1>
          <p>قراءات ESP32 لحظيًا، قرار النظام، التوزيع، والتحكم — بلا بيانات وهمية.</p>
        </div>
        <span className="badge">Live</span>
      </div>
      <LiveDashboard />
      <div className="sim-divider"><span>وضع المحاكاة · Simulation mode</span></div>
      <DashboardScreen />
    </>
  );
}

```

---

## `src/lib/energy/live.ts`

عقد القراءة + قرار النظام + حالة البطارية

```ts
import type { RecommendedAction } from "@/types/energy";

/** One hardware reading, normalised across USB / BLE / cloud. */
export interface LiveReading {
  solarW: number;
  loadW: number;
  batteryW: number | null;   // signed: + charging, − discharging
  batteryV: number | null;
  batteryA: number | null;
  batteryPct: number | null; // null = no BMS (honest)
  lux: number | null;
  tempC: number | null;
  humidity: number | null;
  relay: "on" | "off" | null;
}

const BALANCE_TOLERANCE_W = 5;

/** Decision derived ONLY from measured flows — never from a hidden simulator.
 *  This is what the live dashboard shows; the simulator has its own engine. */
export function liveDecision(r: LiveReading, ar: boolean): { action: RecommendedAction; reason: string } {
  const net = r.solarW - r.loadW;

  if (net < -BALANCE_TOLERANCE_W) {
    return {
      action: "energy_shortage",
      reason: ar
        ? `الاستهلاك يتجاوز الإنتاج بـ ${Math.round(-net)} واط. لا يوجد فائض لتوجيهه — يُقترح تقليل الأحمال غير الأساسية.`
        : `Consumption exceeds production by ${Math.round(-net)} W. No surplus to route — reduce non-essential loads.`,
    };
  }
  if (net <= BALANCE_TOLERANCE_W) {
    return {
      action: "no_action",
      reason: ar
        ? `الإنتاج والاستهلاك متقاربان (فرق ${Math.round(net)} واط). المنظومة متوازنة ولا تحتاج إجراءً.`
        : `Production and demand are within ${Math.round(net)} W. The system is balanced; no action needed.`,
    };
  }
  if (r.batteryW !== null && r.batteryW > BALANCE_TOLERANCE_W) {
    return {
      action: "battery_storage",
      reason: ar
        ? `الفائض ${Math.round(net)} واط، والبطارية تشحن فعلًا بـ ${Math.round(r.batteryW)} واط — التخزين يعمل الآن.`
        : `${Math.round(net)} W surplus and the battery is charging at ${Math.round(r.batteryW)} W — storage is active.`,
    };
  }
  if (r.relay === "on") {
    return {
      action: "additional_load",
      reason: ar
        ? `الفائض ${Math.round(net)} واط يغذّي الحمل المُشغَّل عبر الريليه — استهلاك مباشر بلا هدر.`
        : `${Math.round(net)} W surplus is feeding the relay load — direct use, no waste.`,
    };
  }
  return {
    action: "battery_storage",
    reason: ar
      ? `لديك فائض ${Math.round(net)} واط غير موجَّه. اربط البطارية لشحنه أو شغّل حملًا من الريليه بدل هدره.`
      : `You have ${Math.round(net)} W of un-routed surplus. Charge the battery or switch a relay load instead of wasting it.`,
  };
}

/** Battery state label from SOC when available, else from signed power. */
export function batteryState(r: LiveReading, ar: boolean): { label: string; tone: "ok" | "warn" | "bad" | "unknown" } {
  if (r.batteryPct !== null) {
    if (r.batteryPct >= 80) return { label: ar ? "ممتلئة" : "Full", tone: "ok" };
    if (r.batteryPct >= 40) return { label: ar ? "متوسطة" : "Medium", tone: "warn" };
    return { label: ar ? "منخفضة" : "Low", tone: "bad" };
  }
  if (r.batteryW !== null && r.batteryW > 5) return { label: ar ? "تشحن الآن" : "Charging", tone: "ok" };
  if (r.batteryW !== null && r.batteryW < -5) return { label: ar ? "تفرّغ الآن" : "Discharging", tone: "warn" };
  return { label: ar ? "غير متاح (لا BMS)" : "Unknown (no BMS)", tone: "unknown" };
}

```

---

## `src/components/dashboard/LiveDashboard.tsx`

الأقسام التسعة (Tailwind) — كامل المكوّن

```tsx
"use client";

import { useEffect, useState } from "react";
import { Activity, BatteryCharging, BatteryFull, BatteryLow, Cable, Bluetooth, Cloud, Download, Gauge, History, Plug, PlugZap, RefreshCw, RotateCcw, Sun, TriangleAlert, Waves } from "lucide-react";
import { ACTION_META, type RecommendedAction } from "@/types/energy";
import { batteryState, liveDecision } from "@/lib/energy/live";
import { useSolar } from "./SolarProvider";

/* ── Tailwind recipes ────────────────────────────────────────────────────────
   Every visual value below is a utility class; colours read from the design
   tokens in globals.css so the dashboard stays inside the same system.       */

const SHELL = "mb-6 rounded-[22px] border-[1.5px] border-[#cfe3d4] bg-gradient-to-b from-white to-[#f6faf7] p-5 shadow-[0_14px_36px_rgba(4,120,87,0.10)]";
const HEAD = "flex flex-wrap items-center justify-between gap-3";
const H2 = "flex items-center gap-2 text-[17px] font-semibold text-[color:var(--ink)]";
const H3 = "mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]";
const ICON = "shrink-0 text-[#047857]";
const CARD = "mb-3 min-w-0 rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-[0_6px_18px_rgba(23,61,51,0.06)]";
const TILE = "min-w-0 rounded-[14px] border border-[color:var(--border)] bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(23,61,51,0.05)]";
const TILE_LABEL = "flex items-center gap-1.5 text-[11.5px] leading-4 text-[color:var(--muted)]";
const TILE_VALUE = "mt-1 block text-[22px] font-extrabold text-[color:var(--ink)] max-sm:text-[18px]";
const SMALL = "mt-2 text-xs leading-6 text-[color:var(--muted)]";
const PILL = "rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap";
const ROW = "mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-2";
const MINI = "inline-flex items-center gap-1.5 text-xs text-[color:var(--muted)]";

const SOURCE_LABEL: Record<string, { ar: string; en: string }> = {
  usb: { ar: "USB مباشر", en: "USB live" },
  ble: { ar: "بلوتوث مباشر", en: "Bluetooth live" },
  cloud: { ar: "سحابة (ESP32)", en: "Cloud (ESP32)" },
};

function fmtTime(at: number, ar: boolean) {
  return new Date(at).toLocaleTimeString(ar ? "ar-SA" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function LiveDashboard() {
  const {
    lang, deviceReading, deviceAt, deviceSource, history, decisionLog, relayState, setRelayCommand,
    studyTotals, resetStudy,
    serialStatus, connectSerial, disconnectSerial, bleStatus, connectBluetooth, disconnectBluetooth,
  } = useSolar();
  const ar = lang === "ar";
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  const age = deviceAt ? now - deviceAt : Infinity;
  const fresh = !!deviceReading && age < 15000;

  async function relay(state: "on" | "off") {
    setBusy(true);
    await setRelayCommand(state);
    setBusy(false);
  }

  /** Session export: summary header + every measured sample. Nothing is
   *  interpolated; a value that was not measured stays empty. */
  function exportCsv() {
    const rows: string[] = [];
    const exportedAt = new Date().toISOString();
    rows.push("# SolarWise field-study session export");
    rows.push(`# exported_at,${exportedAt}`);
    rows.push(`# session_seconds,${Math.round(studyTotals.seconds)}`);
    rows.push(`# device_source,${deviceSource ?? "unknown"}`);
    rows.push(`# solar_wh,${studyTotals.solarWh.toFixed(3)}`);
    rows.push(`# load_wh,${studyTotals.loadWh.toFixed(3)}`);
    rows.push(`# battery_wh_signed,${studyTotals.batteryWh.toFixed(3)}`);
    rows.push(`# import_wh,${studyTotals.importWh.toFixed(3)}`);
    rows.push(`# export_wh,${studyTotals.exportWh.toFixed(3)}`);
    rows.push(`# peak_import_wh_17_22,${studyTotals.peakImportWh.toFixed(3)}`);
    const sc = studyTotals.solarWh > 0 ? Math.round(((studyTotals.solarWh - studyTotals.exportWh) / studyTotals.solarWh) * 100) : "";
    const cov = studyTotals.loadWh > 0 ? Math.min(100, Math.round((studyTotals.solarWh / studyTotals.loadWh) * 100)) : "";
    rows.push(`# self_consumption_pct,${sc}`);
    rows.push(`# coverage_pct,${cov}`);
    rows.push("# note,integrated from measured readings only; current session");
    rows.push("");
    rows.push("timestamp_iso,solar_w,load_w,battery_w");
    for (const p of history) {
      rows.push(`${new Date(p.t).toISOString()},${p.solarW.toFixed(1)},${p.loadW.toFixed(1)},${p.batteryW !== null ? p.batteryW.toFixed(1) : ""}`);
    }
    const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solarwise-session-${exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ── Empty state: no fake numbers ─────────────────────────────────────────
  if (!fresh || !deviceReading) {
    return (
      <section className={SHELL}>
        <div className={HEAD}>
          <h2 className={H2}><Activity size={18} className={ICON} aria-hidden="true" />{ar ? "لوحة المراقبة الحية" : "Live monitoring"}</h2>
          <span className={`${PILL} bg-slate-100 text-slate-500`}>{ar ? "لا توجد قراءة حية" : "No live reading"}</span>
        </div>
        <div className="grid justify-items-center gap-2 px-4 py-7 text-center">
          <Waves size={26} className={ICON} aria-hidden="true" />
          <h3 className="text-base font-semibold text-[color:var(--ink)]">{ar ? "اربط وحدة ESP32 لعرض القراءات الحقيقية" : "Connect the ESP32 to see real readings"}</h3>
          <p className={`max-w-[52ch] text-[13px] leading-7 text-[color:var(--muted)]`}>
            {ar
              ? "هذه اللوحة لا تعرض أي أرقام وهمية. صِل الجهاز عبر USB أو البلوتوث، أو انتظر وصول قراءة من السحابة."
              : "This panel never shows invented numbers. Connect over USB or Bluetooth, or wait for a cloud reading."}
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {serialStatus !== "connected" ? (
              <button className="button primary" onClick={() => void connectSerial()} disabled={serialStatus === "connecting" || serialStatus === "unsupported"}>
                <Cable size={16} />{serialStatus === "unsupported" ? (ar ? "USB غير مدعوم" : "USB unsupported") : (ar ? "اتصال USB" : "USB connect")}
              </button>
            ) : (
              <button className="button" onClick={disconnectSerial}><Cable size={16} />{ar ? "فصل USB" : "USB disconnect"}</button>
            )}
            {bleStatus !== "connected" ? (
              <button className="button" onClick={() => void connectBluetooth()} disabled={bleStatus === "connecting" || bleStatus === "unsupported"}>
                <Bluetooth size={16} />{bleStatus === "unsupported" ? (ar ? "BLE غير مدعوم" : "BLE unsupported") : (ar ? "اتصال بلوتوث" : "Bluetooth connect")}
              </button>
            ) : (
              <button className="button" onClick={disconnectBluetooth}><Bluetooth size={16} />{ar ? "فصل البلوتوث" : "Bluetooth disconnect"}</button>
            )}
          </div>
          {deviceReading && !fresh && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-amber-700">
              <TriangleAlert size={14} aria-hidden="true" />
              {ar ? `آخر قراءة وصلت قبل ${Math.round(age / 1000)} ثانية — لا تُعرض كحالية.` : `Last reading arrived ${Math.round(age / 1000)}s ago — not shown as current.`}
            </p>
          )}
        </div>
      </section>
    );
  }

  // ── Derived metrics (all from the reading) ───────────────────────────────
  const net = deviceReading.solarW - deviceReading.loadW;
  const surplus = Math.max(0, net);
  const shortage = Math.max(0, -net);
  const status = net > 5 ? "SURPLUS" : net < -5 ? "SHORTAGE" : "BALANCED";
  const decision = liveDecision(deviceReading, ar);
  const bstate = batteryState(deviceReading, ar);
  const srcLabel = SOURCE_LABEL[deviceSource ?? "usb"]?.[ar ? "ar" : "en"] ?? "USB";

  const solar = Math.max(1, deviceReading.solarW);
  const selfUsed = Math.min(deviceReading.solarW, deviceReading.loadW);
  const toBattery = Math.max(0, deviceReading.batteryW ?? 0);
  const exported = Math.max(0, deviceReading.solarW - deviceReading.loadW - toBattery);
  const pct = (v: number) => Math.round((v / solar) * 100);

  const maxPoint = Math.max(1, ...history.map(p => Math.max(p.solarW, p.loadW)));
  const kwh = (wh: number) => wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${Math.round(wh)} Wh`;
  const selfConsumption = studyTotals.solarWh > 0
    ? Math.round(((studyTotals.solarWh - studyTotals.exportWh) / studyTotals.solarWh) * 100)
    : null;
  const coverage = studyTotals.loadWh > 0
    ? Math.min(100, Math.round((studyTotals.solarWh / studyTotals.loadWh) * 100))
    : null;
  const sessionLabel = studyTotals.seconds >= 60
    ? `${Math.round(studyTotals.seconds / 60)} ${ar ? "د" : "min"}`
    : `${Math.round(studyTotals.seconds)} ${ar ? "ث" : "s"}`;
  const line = (field: "solarW" | "loadW") =>
    history.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / Math.max(1, history.length - 1)) * 100} ${38 - (p[field] / maxPoint) * 34}`).join(" ");
  const solarArea = history.length ? `${line("solarW")} L 100 38 L 0 38 Z` : "";

  return (
    <section className={SHELL}>
      <div className={HEAD}>
        <h2 className={H2}><Activity size={18} className={ICON} aria-hidden="true" />{ar ? "لوحة المراقبة الحية" : "Live monitoring"}</h2>
        <span className={`${PILL} ${fresh ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {fresh ? (ar ? `مباشر · ${srcLabel}` : `Live · ${srcLabel}`) : (ar ? "قديمة" : "Stale")}
        </span>
      </div>
      <p className="mt-1.5 mb-3.5 text-xs text-[color:var(--muted)]">
        {ar ? "آخر تحديث" : "Updated"} {fmtTime(deviceAt, ar)} · {ar ? "كل القيم من الجهاز" : "all values from the device"}
      </p>

      {/* 1 · Energy overview (0x41 solar, 0x44 load) */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className={TILE}><span className={TILE_LABEL}><Sun size={15} className={ICON} />{ar ? "الإنتاج" : "Production"}</span><strong className={TILE_VALUE} dir="ltr">{Math.round(deviceReading.solarW)} W</strong></div>
        <div className={TILE}><span className={TILE_LABEL}><Plug size={15} className={ICON} />{ar ? "الاستهلاك" : "Consumption"}</span><strong className={TILE_VALUE} dir="ltr">{Math.round(deviceReading.loadW)} W</strong></div>
        <div className={TILE}><span className={TILE_LABEL}><Gauge size={15} className={ICON} />{ar ? "الصافي" : "Net"}</span><strong className={TILE_VALUE} dir="ltr">{net > 0 ? "+" : ""}{Math.round(net)} W</strong></div>
        <div className={TILE}><span className={TILE_LABEL}><BatteryCharging size={15} className={ICON} />{ar ? "البطارية" : "Battery"}</span><strong className={TILE_VALUE} dir="ltr">{deviceReading.batteryW !== null ? `${Math.round(deviceReading.batteryW)} W` : "—"}</strong></div>
      </div>

      <div className={ROW}>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${status === "SURPLUS" ? "bg-emerald-100 text-emerald-700" : status === "SHORTAGE" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700"}`}>
          {ar ? (status === "SURPLUS" ? "فائض" : status === "SHORTAGE" ? "عجز" : "توازن") : status}
        </span>
        <span className={MINI}>{ar ? "فائض" : "Surplus"} <b className="text-[color:var(--ink)]" dir="ltr">{Math.round(surplus)} W</b></span>
        <span className={MINI}>{ar ? "عجز" : "Shortage"} <b className="text-[color:var(--ink)]" dir="ltr">{Math.round(shortage)} W</b></span>
        {deviceReading.lux !== null && <span className={MINI}>{ar ? "الإضاءة" : "Light"} <b className="text-[color:var(--ink)]" dir="ltr">{Math.round(deviceReading.lux)} lux</b></span>}
        {deviceReading.tempC !== null && <span className={MINI}>{ar ? "الحرارة" : "Temp"} <b className="text-[color:var(--ink)]" dir="ltr">{deviceReading.tempC} °C</b></span>}
        {deviceReading.humidity !== null && <span className={MINI}>{ar ? "الرطوبة" : "Humidity"} <b className="text-[color:var(--ink)]" dir="ltr">{deviceReading.humidity} %</b></span>}
      </div>

      <div className="grid items-start gap-2.5 md:grid-cols-2">
        {/* 2 · Battery (0x40) */}
        <article className={CARD}>
          <h3 className={H3}>
            {bstate.tone === "ok" ? <BatteryFull size={17} className={ICON} /> : bstate.tone === "bad" ? <BatteryLow size={17} className={ICON} /> : <BatteryCharging size={17} className={ICON} />}
            {ar ? "تحليل البطارية" : "Battery status"}
          </h3>
          <dl className="mb-2.5 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-[10px] border border-[color:var(--border)] bg-slate-50 px-2.5 py-2">
              <dt className="text-[11px] text-[color:var(--muted)]">{ar ? "نسبة الشحن" : "SOC"}</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-[color:var(--ink)]" dir="ltr">{deviceReading.batteryPct !== null ? `${Math.round(deviceReading.batteryPct)} %` : "—"}</dd>
            </div>
            <div className="min-w-0 rounded-[10px] border border-[color:var(--border)] bg-slate-50 px-2.5 py-2">
              <dt className="text-[11px] text-[color:var(--muted)]">{ar ? "الجهد" : "Voltage"}</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-[color:var(--ink)]" dir="ltr">{deviceReading.batteryV !== null ? `${deviceReading.batteryV.toFixed(2)} V` : "—"}</dd>
            </div>
            <div className="min-w-0 rounded-[10px] border border-[color:var(--border)] bg-slate-50 px-2.5 py-2">
              <dt className="text-[11px] text-[color:var(--muted)]">{ar ? "التيار" : "Current"}</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-[color:var(--ink)]" dir="ltr">{deviceReading.batteryA !== null ? `${deviceReading.batteryA.toFixed(0)} mA` : "—"}</dd>
            </div>
            <div className="min-w-0 rounded-[10px] border border-[color:var(--border)] bg-slate-50 px-2.5 py-2">
              <dt className="text-[11px] text-[color:var(--muted)]">{ar ? "القدرة" : "Power"}</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-[color:var(--ink)]" dir="ltr">{deviceReading.batteryW !== null ? `${Math.round(deviceReading.batteryW)} W` : "—"}</dd>
            </div>
          </dl>
          <span className={`inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-bold ${bstate.tone === "ok" ? "bg-emerald-100 text-emerald-700" : bstate.tone === "bad" ? "bg-red-100 text-red-700" : bstate.tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
            {bstate.label}
          </span>
          {(deviceReading.batteryV === null || deviceReading.batteryPct === null) && (
            <p className={SMALL}>
              {ar
                ? "الشرطة تعني «غير مقيس»: الجهد والتيار يصلان عبر USB أو البلوتوث فقط، ونسبة الشحن تحتاج BMS. لا نخترع رقمًا."
                : "A dash means “not measured”: voltage and current arrive over USB or Bluetooth only, and SOC needs a BMS. We never invent a number."}
            </p>
          )}
        </article>

        {/* 3 · Smart decision */}
        <article className={CARD}>
          <h3 className={H3}><Gauge size={17} className={ICON} />{ar ? "قرار النظام" : "System decision"}</h3>
          <p className="mb-1.5 text-[19px] font-extrabold text-[#047857]">{ar ? ACTION_META[decision.action].labelAr : ACTION_META[decision.action].labelEn}</p>
          <p className="text-xs leading-6 text-[color:var(--muted)]">{decision.reason}</p>
        </article>
      </div>

      {/* 4 · Distribution */}
      <article className={CARD}>
        <h3 className={H3}><Waves size={17} className={ICON} />{ar ? "توزيع الطاقة" : "Energy distribution"}</h3>
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[color:var(--muted)]">
            <span>{ar ? "استهلاك مباشر" : "Direct self-use"}</span>
            <b className="text-[12.5px] text-[color:var(--ink)]" dir="ltr">{Math.round(selfUsed)} W · {pct(selfUsed)}%</b>
            <span className="col-span-2 block h-[7px] overflow-hidden rounded-full bg-slate-200">
              <i className="block h-full rounded-full bg-[#047857]" style={{ width: `${pct(selfUsed)}%` }} />
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[color:var(--muted)]">
            <span>{ar ? "إلى البطارية" : "To battery"}</span>
            <b className="text-[12.5px] text-[color:var(--ink)]" dir="ltr">{Math.round(toBattery)} W · {toBattery ? pct(toBattery) : 0}%</b>
            <span className="col-span-2 block h-[7px] overflow-hidden rounded-full bg-slate-200">
              <i className="block h-full rounded-full bg-[#059669]" style={{ width: `${toBattery ? pct(toBattery) : 0}%` }} />
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[color:var(--muted)]">
            <span>{ar ? "فائض غير موجَّه" : "Un-routed surplus"}</span>
            <b className="text-[12.5px] text-[color:var(--ink)]" dir="ltr">{Math.round(exported)} W · {exported ? pct(exported) : 0}%</b>
            <span className="col-span-2 block h-[7px] overflow-hidden rounded-full bg-slate-200">
              <i className="block h-full rounded-full bg-[#f59e0b]" style={{ width: `${exported ? pct(exported) : 0}%` }} />
            </span>
          </div>
        </div>
        {deviceReading.relay === null && <p className={SMALL}>{ar ? "السيارة الكهربائية غير موصولة بهذه الوحدة." : "No EV channel on this unit."}</p>}
      </article>

      {/* 5 · Recommendation */}
      <article className={CARD}>
        <h3 className={H3}><PlugZap size={17} className={ICON} />{ar ? "التوصية" : "Recommendation"}</h3>
        <p className="text-[13.5px] leading-7 text-[color:var(--ink)]">
          {status === "SHORTAGE"
            ? (ar ? "أوقف الحمل غير الأساسي الآن، واحتفظ بالبطارية للفترة الحرجة." : "Switch off non-essential loads now and keep the battery for the critical window.")
            : status === "BALANCED"
              ? (ar ? "المنظومة متوازنة — لا حاجة لإجراء، راقب فقط." : "Balanced — no action needed, just keep watching.")
              : toBattery > 5
                ? (ar ? "التخزين يعمل — لا تشغّل أحمالًا إضافية حتى تمتلئ البطارية." : "Storage is active — avoid extra loads until the battery fills.")
                : (ar ? "شغّل حملًا الآن (الريليه) بدل هدر الفائض." : "Run a relay load now instead of wasting the surplus.")}
        </p>
      </article>

      {/* 6 · Live trend */}
      <article className={CARD}>
        <h3 className={H3}><Activity size={17} className={ICON} />{ar ? "المراقبة المباشرة" : "Live trend"}</h3>
        {history.length < 2 ? (
          <p className="text-xs text-[color:var(--muted)]">{ar ? "تنتظر عيّنات كافية لرسم المنحنى…" : "Waiting for enough samples to draw the trend…"}</p>
        ) : (
          <>
            <svg className="h-[74px] w-full sm:h-[90px]" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={ar ? "منحنى الإنتاج والاستهلاك" : "Production and consumption trend"}>
              <polyline points="0,38 100,38" className="stroke-slate-200 stroke-1" />
              <path d={solarArea} className="stroke-none fill-[#047857]/10" />
              <path d={line("solarW")} className="fill-none stroke-[#047857] stroke-2 [stroke-linejoin:round]" />
              <path d={line("loadW")} className="fill-none stroke-[#f59e0b] stroke-2 [stroke-linejoin:round]" />
            </svg>
            <div className="flex flex-wrap gap-3 text-[11.5px] text-[color:var(--muted)]">
              <span><i className="me-1.5 inline-block h-[3px] w-2.5 rounded-full bg-[#047857] align-middle" />{ar ? "إنتاج" : "Production"} · {Math.round(history[history.length - 1].solarW)} W</span>
              <span><i className="me-1.5 inline-block h-[3px] w-2.5 rounded-full bg-[#f59e0b] align-middle" />{ar ? "استهلاك" : "Consumption"} · {Math.round(history[history.length - 1].loadW)} W</span>
              <span className="text-[color:var(--muted)]">{history.length} {ar ? "عيّنة" : "samples"} · {ar ? "أقصى" : "peak"} {Math.round(maxPoint)} W</span>
            </div>
          </>
        )}
      </article>

      {/* 7 · Field-study metrics */}
      <article className={CARD}>
        <h3 className={H3}><History size={17} className={ICON} />{ar ? "مؤشرات الدراسة الميدانية" : "Field-study metrics"}</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "مدة الجلسة" : "Session"}</span><strong className={TILE_VALUE} dir="ltr">{sessionLabel}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "طاقة شمسية" : "Solar energy"}</span><strong className={TILE_VALUE} dir="ltr">{kwh(studyTotals.solarWh)}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "استهلاك" : "Load energy"}</span><strong className={TILE_VALUE} dir="ltr">{kwh(studyTotals.loadWh)}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "إلى البطارية" : "To battery"}</span><strong className={TILE_VALUE} dir="ltr">{kwh(studyTotals.batteryWh)}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "الاستهلاك الذاتي" : "Self-consumption"}</span><strong className={TILE_VALUE} dir="ltr">{selfConsumption !== null ? `${selfConsumption}%` : "—"}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "تغطية الاستهلاك" : "Coverage"}</span><strong className={TILE_VALUE} dir="ltr">{coverage !== null ? `${coverage}%` : "—"}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "استيراد الذروة" : "Peak-hour import"}</span><strong className={TILE_VALUE} dir="ltr">{kwh(studyTotals.peakImportWh)}</strong></div>
          <div className={TILE}><span className={TILE_LABEL}>{ar ? "إجمالي الاستيراد" : "Total import"}</span><strong className={TILE_VALUE} dir="ltr">{kwh(studyTotals.importWh)}</strong></div>
        </div>
        <p className={SMALL}>
          {ar
            ? "تكامل زمني من القراءات الفعلية (Wh) — لا تقديرات. الجلسة الحالية فقط، والدراسة الميدانية تحتاج أسابيع. الذروة محسوبة بين 17:00 و22:00."
            : "Time-integrated from real readings (Wh) — no estimates. Current session only; the field study needs weeks. Peak window is 17:00–22:00."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="button" onClick={resetStudy}><RotateCcw size={15} />{ar ? "تصفير الجلسة" : "Reset session"}</button>
          <button className="button" onClick={exportCsv} disabled={history.length === 0} data-testid="study-csv">
            <Download size={15} />{ar ? "تصدير CSV" : "Export CSV"}
          </button>
        </div>
      </article>

      {/* 8 · Relay control (GPIO 19) */}
      <article className={CARD}>
        <h3 className={H3}><Plug size={17} className={ICON} />{ar ? "التحكم بالريليه (GPIO 19)" : "Relay control (GPIO 19)"}</h3>
        <div className="mb-2 flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-2">
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold max-sm:col-span-2 max-sm:justify-self-start ${relayState === "on" ? "bg-emerald-100 text-emerald-700" : relayState === "off" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
            {relayState === "on" ? (ar ? "يعمل" : "ON") : relayState === "off" ? (ar ? "متوقف" : "OFF") : (ar ? "غير معروف" : "Unknown")}
          </span>
          <button className="button primary max-sm:justify-center" disabled={busy} onClick={() => void relay("on")}><PlugZap size={16} />{ar ? "تشغيل" : "Turn on"}</button>
          <button className="button max-sm:justify-center" disabled={busy} onClick={() => void relay("off")}><Plug size={16} />{ar ? "إيقاف" : "Turn off"}</button>
        </div>
        <p className={SMALL}>
          {ar
            ? "الأمر يُرسل عبر القناة النشطة: بلوتوث ← USB ← سحابة. إن لم تصل قناة، يُدرج الأمر في طابور السحابة."
            : "The command uses the active channel: Bluetooth → USB → cloud. If none is live, it is queued in the cloud."}
        </p>
      </article>

      {/* 9 · Decision history */}
      <article className={CARD}>
        <h3 className={H3}><History size={17} className={ICON} />{ar ? "سجل القرارات" : "Decision history"}</h3>
        {decisionLog.length === 0 ? (
          <p className="text-xs text-[color:var(--muted)]">{ar ? "لا قرارات بعد — يبدأ السجل عند تغيّر حالة المنظومة." : "No decisions yet — the log starts when the system state changes."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="bg-[#eef5f1] px-3 py-2.5 text-start text-[11.5px] font-bold text-[color:var(--muted)]">{ar ? "الوقت" : "Time"}</th>
                  <th className="bg-[#eef5f1] px-3 py-2.5 text-start text-[11.5px] font-bold text-[color:var(--muted)]">{ar ? "القرار" : "Decision"}</th>
                  <th className="bg-[#eef5f1] px-3 py-2.5 text-start text-[11.5px] font-bold text-[color:var(--muted)]">{ar ? "إنتاج/استهلاك" : "Prod/Load"}</th>
                  <th className="bg-[#eef5f1] px-3 py-2.5 text-start text-[11.5px] font-bold text-[color:var(--muted)]">{ar ? "المصدر" : "Source"}</th>
                </tr>
              </thead>
              <tbody>
                {decisionLog.map((d, i) => (
                  <tr key={`${d.at}-${i}`} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-start text-[color:var(--ink)]" dir="ltr">{fmtTime(d.at, ar)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-start text-[color:var(--ink)]">{ar ? ACTION_META[d.action as RecommendedAction].labelAr : ACTION_META[d.action as RecommendedAction].labelEn}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-start text-[color:var(--ink)]" dir="ltr">{Math.round(d.solarW)} / {Math.round(d.loadW)} W</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-start text-[color:var(--muted)]">{SOURCE_LABEL[d.source]?.[ar ? "ar" : "en"] ?? (ar ? "محاكاة" : "Simulation")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <div className="flex flex-wrap items-center gap-2">
        {serialStatus === "connected" ? (
          <button className="button" onClick={disconnectSerial}><Cable size={15} />{ar ? "فصل USB" : "USB off"}</button>
        ) : (
          <button className="button" onClick={() => void connectSerial()} disabled={serialStatus === "unsupported"}><Cable size={15} />{ar ? "اتصال USB" : "USB"}</button>
        )}
        {bleStatus === "connected" ? (
          <button className="button" onClick={disconnectBluetooth}><Bluetooth size={15} />{ar ? "فصل البلوتوث" : "BLE off"}</button>
        ) : (
          <button className="button" onClick={() => void connectBluetooth()} disabled={bleStatus === "unsupported"}><Bluetooth size={15} />{ar ? "بلوتوث" : "BLE"}</button>
        )}
        <span className={MINI}><Cloud size={14} /> {ar ? "السحابة تلقائية" : "Cloud automatic"} <RefreshCw size={12} /></span>
      </div>
    </section>
  );
}

```

---

## `src/components/dashboard/SolarProvider.tsx`

القنوات (USB/BLE/Cloud) + القراءة الموحّدة + السجل + الريليه

```tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { calculateEnergy } from "@/lib/energy/calculations";
import { fallbackDecide } from "@/lib/ai/fallback";
import { buildDecisionRequest, DEFAULT_SIM_STATE, SCENARIOS, type SimState } from "@/lib/energy/scenarios";
import { liveDecision, type LiveReading } from "@/lib/energy/live";
import type { DecisionResponse, RecommendedAction } from "@/types/energy";
import type { Lang } from "./lang";

export interface Message {
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  snapshot: string;
  decision?: RecommendedAction;
  error?: boolean;
  /** True while tokens are still streaming in — render live, skip typewriter. */
  live?: boolean;
}

/** Nordic UART Service — the de-facto BLE serial profile used by our ESP32. */
const BLE_UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_UART_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
/** Device id used by the cloud command channel. */
const CLOUD_DEVICE_ID = "solarwise-esp32-01";
/** A reading older than this is stale and must not be shown as live. */
const LIVE_TTL_MS = 15000;

export type DeviceReading = LiveReading;

export type DeviceSource = "usb" | "ble" | "cloud";

export interface HistoryPoint { t: number; solarW: number; loadW: number; batteryW: number | null }

export interface DecisionEntry {
  at: number;
  action: RecommendedAction;
  reason: string;
  solarW: number;
  loadW: number;
  batteryPct: number | null;
  source: DeviceSource | "simulation";
}

/** Session accumulators for the field-study KPIs (measured, never estimated). */
export interface StudyTotals {
  startedAt: number;
  seconds: number;
  solarWh: number;
  loadWh: number;
  batteryWh: number;   // signed: + charged, − discharged
  importWh: number;
  exportWh: number;
  peakImportWh: number; // 17:00–22:00 local
}

const EMPTY_STUDY: StudyTotals = {
  startedAt: 0, seconds: 0, solarWh: 0, loadWh: 0, batteryWh: 0,
  importWh: 0, exportWh: 0, peakImportWh: 0,
};

function useSolarState() {
  const [lang, setLang] = useState<Lang>("ar");
  const [sim, setSim] = useState<SimState>({ ...DEFAULT_SIM_STATE });
  const [scenarioId, setScenarioId] = useState("s1");
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [dataMode, setDataMode] = useState<"simulation" | "hardware">("simulation");
  const [serialStatus, setSerialStatus] = useState<"unsupported" | "disconnected" | "connecting" | "connected">("disconnected");
  const [bleStatus, setBleStatus] = useState<"unsupported" | "disconnected" | "connecting" | "connected">("disconnected");
  const [bleReading, setBleReading] = useState<{ solarW: number; consumptionW: number; lux: number | null; tempC: number | null; relay: string | null } | null>(null);
  const [deviceReading, setDeviceReading] = useState<DeviceReading | null>(null);
  const [deviceAt, setDeviceAt] = useState(0);
  const [deviceSource, setDeviceSource] = useState<DeviceSource | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [decisionLog, setDecisionLog] = useState<DecisionEntry[]>([]);
  const [relayState, setRelayState] = useState<"on" | "off" | "unknown">("unknown");
  const [studyTotals, setStudyTotals] = useState<StudyTotals>(EMPTY_STUDY);
  const [live, setLive] = useState<{ solarW: number; consumptionW: number; batteryPct: number | null; ageMs: number } | null>(null);
  const revision = useRef(0);
  const decisionRequest = useRef<AbortController | null>(null);
  const chatRequest = useRef<AbortController | null>(null);
  const serialReader = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const serialAbort = useRef<AbortController | null>(null);
  const serialPort = useRef<SerialPortLike | null>(null);
  const bleDevice = useRef<BluetoothDeviceLike | null>(null);
  const bleHandler = useRef<{ tx: BluetoothCharacteristicLike; onValue: (event: Event) => void } | null>(null);
  const bleBuffer = useRef("");
  const studyRef = useRef<StudyTotals>(EMPTY_STUDY);
  const lastSampleAt = useRef(0);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => () => {
    decisionRequest.current?.abort();
    chatRequest.current?.abort();
    serialAbort.current?.abort();
    serialReader.current?.cancel().catch(() => undefined);
    bleHandler.current?.tx.removeEventListener("characteristicvaluechanged", bleHandler.current.onValue);
    bleDevice.current?.gatt?.disconnect();
  }, []);
  // Poll the latest accepted ESP32 reading; the homepage shows it when fresh.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/telemetry");
        const data = await res.json();
        if (!alive || !res.ok) return;
        const l = data?.latest;
        if (l && typeof data?.ageMs === "number") {
          setLive({ solarW: l.solarProductionW, consumptionW: l.consumptionW, batteryPct: l.batteryLevelPercent ?? null, ageMs: data.ageMs });
          if (data.ageMs < LIVE_TTL_MS) {
            ingestReading({
              solarW: l.solarProductionW,
              loadW: l.consumptionW,
              batteryW: null,
              batteryV: null,
              batteryA: null,
              batteryPct: typeof l.batteryLevelPercent === "number" ? l.batteryLevelPercent : null,
              lux: null,
              tempC: null,
              humidity: null,
              relay: null,
            }, "cloud");
          }
        } else if (alive) {
          setLive(null);
        }
      } catch { /* telemetry unavailable — simulation values stay */ }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const calc = calculateEnergy(sim.solarProductionW, sim.consumptionW);
  const preview = fallbackDecide(buildDecisionRequest(sim));
  const decision = result?.decision ?? { ...preview, confidence: null };

  /** Every transport funnels here: one reading shape, one history, one log. */
  function ingestReading(reading: DeviceReading, source: DeviceSource) {
    const nowMs = Date.now();
    const previous = lastSampleAt.current;
    const dt = previous ? Math.min(60, Math.max(0, (nowMs - previous) / 1000)) : 0;
    lastSampleAt.current = nowMs;

    if (dt > 0) {
      const t = studyRef.current;
      const net = reading.solarW - reading.loadW;
      const imported = Math.max(0, -net);
      const exported = Math.max(0, net - Math.max(0, reading.batteryW ?? 0));
      const hour = new Date(nowMs).getHours();
      const inPeak = hour >= 17 && hour < 22;
      const nextTotals: StudyTotals = {
        startedAt: t.startedAt || nowMs,
        seconds: t.seconds + dt,
        solarWh: t.solarWh + (reading.solarW * dt) / 3600,
        loadWh: t.loadWh + (reading.loadW * dt) / 3600,
        batteryWh: t.batteryWh + ((reading.batteryW ?? 0) * dt) / 3600,
        importWh: t.importWh + (imported * dt) / 3600,
        exportWh: t.exportWh + (exported * dt) / 3600,
        peakImportWh: t.peakImportWh + (inPeak ? (imported * dt) / 3600 : 0),
      };
      studyRef.current = nextTotals;
      setStudyTotals(nextTotals);
    }

    setDeviceReading(reading);
    setDeviceAt(Date.now());
    setDeviceSource(source);
    if (reading.relay) setRelayState(reading.relay);
    setHistory(prev => [...prev, {
      t: Date.now(),
      solarW: reading.solarW,
      loadW: reading.loadW,
      batteryW: reading.batteryW,
    }].slice(-60));
  }

  /** Append one entry per live-decision change (not per sample). */
  const lastLoggedAction = useRef<string | null>(null);
  useEffect(() => {
    if (!deviceReading || !deviceSource) return;
    const d = liveDecision(deviceReading, lang === "ar");
    if (lastLoggedAction.current === d.action) return;
    lastLoggedAction.current = d.action;
    setDecisionLog(prev => [{
      at: Date.now(),
      action: d.action,
      reason: d.reason,
      solarW: deviceReading.solarW,
      loadW: deviceReading.loadW,
      batteryPct: deviceReading.batteryPct,
      source: deviceSource,
    }, ...prev].slice(0, 25));
  }, [deviceReading, deviceSource, lang]);

  /** Reset the session accumulators (useful before each demo run). */
  function resetStudy() {
    studyRef.current = { ...EMPTY_STUDY };
    lastSampleAt.current = 0;
    setStudyTotals({ ...EMPTY_STUDY });
    setHistory([]);
    setDecisionLog([]);
    lastLoggedAction.current = null;
  }

  /** Relay command routed to whichever transport is live. */
  async function setRelayCommand(state: "on" | "off") {
    if (bleStatus === "connected") {
      const ok = await sendBluetoothCommand("loads", state);
      if (ok) setRelayState(state);
      return ok;
    }
    if (serialStatus === "connected" && serialPort.current?.writable) {
      try {
        const writer = serialPort.current.writable.getWriter();
        await writer.write(new TextEncoder().encode(JSON.stringify({ relay: "loads", state }) + "\n"));
        writer.releaseLock();
        setRelayState(state);
        return true;
      } catch { return false; }
    }
    try {
      const res = await fetch("/api/device/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: CLOUD_DEVICE_ID, relay: "loads", state, reason: "dashboard" }),
      });
      if (!res.ok) return false;
      setRelayState(state);
      return true;
    } catch { return false; }
  }

  function patch(change: Partial<SimState>, scenario = "") {
    // Invalidate synchronously: a response already in flight cannot commit an old snapshot.
    revision.current += 1;
    decisionRequest.current?.abort();
    decisionRequest.current = null;
    setSim(previous => ({ ...previous, ...change }));
    setScenarioId(scenario);
    setResult(null);
    setLoading(false);
    setAnalysisError(false);
    if (dataMode === "hardware") setDataMode("simulation");
  }

  async function connectSerial() {
    const serial = (navigator as Navigator & { serial?: { requestPort: () => Promise<SerialPortLike> } }).serial;
    if (!serial) {
      setSerialStatus("unsupported");
      return;
    }
    serialAbort.current?.abort();
    setSerialStatus("connecting");
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPort.current = port;
      const decoder = new TextDecoderStream();
      serialAbort.current = new AbortController();
      if (!port.readable) throw new Error("Serial port is not readable");
      port.readable.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>, { signal: serialAbort.current.signal }).catch(() => undefined);
      const reader = decoder.readable.getReader();
      serialReader.current = reader;
      setDataMode("hardware");
      setSerialStatus("connected");
      let buffer = "";
      while (!serialAbort.current.signal.aborted) {
        const next = await reader.read();
        if (next.done) break;
        buffer += next.value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const reading = JSON.parse(line) as {
              solarProductionW?: number; consumptionW?: number; batteryLevelPercent?: number;
              batteryPowerW?: number; batteryVoltageV?: number; batteryCurrentA?: number;
              lightLux?: number; temperatureC?: number; humidityPct?: number; relay?: "on" | "off";
            };
            const change: Partial<SimState> = {};
            if (Number.isFinite(reading.solarProductionW)) change.solarProductionW = Math.max(0, Math.round(reading.solarProductionW!));
            if (Number.isFinite(reading.consumptionW)) change.consumptionW = Math.max(0, Math.round(reading.consumptionW!));
            if (Number.isFinite(reading.batteryLevelPercent)) change.batteryLevelPct = Math.min(100, Math.max(0, Math.round(reading.batteryLevelPercent!)));
            if (Object.keys(change).length) {
              setSim(previous => ({ ...previous, ...change }));
              setResult(null);
            }
            if (Number.isFinite(reading.solarProductionW) || Number.isFinite(reading.consumptionW)) {
              ingestReading({
                solarW: Number.isFinite(reading.solarProductionW) ? reading.solarProductionW! : 0,
                loadW: Number.isFinite(reading.consumptionW) ? reading.consumptionW! : 0,
                batteryW: Number.isFinite(reading.batteryPowerW) ? reading.batteryPowerW! : null,
                batteryV: Number.isFinite(reading.batteryVoltageV) ? reading.batteryVoltageV! : null,
                batteryA: Number.isFinite(reading.batteryCurrentA) ? reading.batteryCurrentA! : null,
                batteryPct: Number.isFinite(reading.batteryLevelPercent) ? reading.batteryLevelPercent! : null,
                lux: Number.isFinite(reading.lightLux) ? reading.lightLux! : null,
                tempC: Number.isFinite(reading.temperatureC) ? reading.temperatureC! : null,
                humidity: Number.isFinite(reading.humidityPct) ? reading.humidityPct! : null,
                relay: reading.relay === "on" || reading.relay === "off" ? reading.relay : null,
              }, "usb");
            }
          } catch { /* Ignore incomplete/non-JSON serial lines. */ }
        }
      }
      await reader.cancel();
      await port.close();
    } catch {
      setSerialStatus("disconnected");
      setDataMode("simulation");
    } finally {
      serialReader.current = null;
      if (serialStatus !== "unsupported") setSerialStatus("disconnected");
    }
  }

  function disconnectSerial() {
    serialAbort.current?.abort();
    serialReader.current?.cancel().catch(() => undefined);
    serialReader.current = null;
    serialPort.current = null;
    setSerialStatus("disconnected");
    setDataMode("simulation");
  }

  // ── Bluetooth (BLE UART) — the same JSON lines as USB, over the air ──
  async function connectBluetooth() {
    const bt = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
    if (!bt) {
      setBleStatus("unsupported");
      return;
    }
    setBleStatus("connecting");
    try {
      const device = await bt.requestDevice({
        filters: [{ services: [BLE_UART_SERVICE] }],
        optionalServices: [BLE_UART_SERVICE],
      });
      if (!device.gatt) throw new Error("GATT unavailable");
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_UART_SERVICE);
      const tx = await service.getCharacteristic(BLE_UART_TX);

      bleDevice.current = device;
      bleBuffer.current = "";

      const onValue = (event: Event) => {
        const value = (event.target as BluetoothCharacteristicLike).value;
        if (!value) return;
        bleBuffer.current += new TextDecoder().decode(value);
        const lines = bleBuffer.current.split(/\r?\n/);
        bleBuffer.current = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const reading = JSON.parse(line) as {
              solarProductionW?: number; consumptionW?: number;
              lightLux?: number; temperatureC?: number; relay?: string;
            };
            const change: Partial<SimState> = {};
            if (Number.isFinite(reading.solarProductionW)) change.solarProductionW = Math.max(0, Math.round(reading.solarProductionW!));
            if (Number.isFinite(reading.consumptionW)) change.consumptionW = Math.max(0, Math.round(reading.consumptionW!));
            if (Object.keys(change).length) {
              setSim(previous => ({ ...previous, ...change }));
              setResult(null);
            }
            setBleReading({
              solarW: Number.isFinite(reading.solarProductionW) ? reading.solarProductionW! : 0,
              consumptionW: Number.isFinite(reading.consumptionW) ? reading.consumptionW! : 0,
              lux: Number.isFinite(reading.lightLux) ? reading.lightLux! : null,
              tempC: Number.isFinite(reading.temperatureC) ? reading.temperatureC! : null,
              relay: typeof reading.relay === "string" ? reading.relay : null,
            });
            ingestReading({
              solarW: Number.isFinite(reading.solarProductionW) ? reading.solarProductionW! : 0,
              loadW: Number.isFinite(reading.consumptionW) ? reading.consumptionW! : 0,
              batteryW: Number.isFinite((reading as { batteryPowerW?: number }).batteryPowerW) ? (reading as { batteryPowerW?: number }).batteryPowerW! : null,
              batteryV: null,
              batteryA: null,
              batteryPct: null,
              lux: Number.isFinite(reading.lightLux) ? reading.lightLux! : null,
              tempC: Number.isFinite(reading.temperatureC) ? reading.temperatureC! : null,
              humidity: null,
              relay: reading.relay === "on" || reading.relay === "off" ? reading.relay : null,
            }, "ble");
          } catch { /* ignore partial / non-JSON BLE chunks */ }
        }
      };

      tx.addEventListener("characteristicvaluechanged", onValue);
      bleHandler.current = { tx, onValue };
      await tx.startNotifications();

      device.addEventListener("gattserverdisconnected", () => {
        setBleStatus("disconnected");
        setDataMode("simulation");
      });

      setBleStatus("connected");
      setDataMode("hardware");
    } catch {
      setBleStatus("disconnected");
      setDataMode("simulation");
    }
  }

  function disconnectBluetooth() {
    const handler = bleHandler.current;
    if (handler) {
      handler.tx.removeEventListener("characteristicvaluechanged", handler.onValue);
      handler.tx.stopNotifications().catch(() => undefined);
      bleHandler.current = null;
    }
    bleDevice.current?.gatt?.disconnect();
    bleDevice.current = null;
    setBleStatus("disconnected");
    setBleReading(null);
    setDataMode("simulation");
  }

  /** Send a relay command back to the ESP32 over the same BLE link. */
  async function sendBluetoothCommand(relay: "loads", state: "on" | "off") {
    const handler = bleHandler.current;
    if (!handler) return false;
    try {
      const payload = JSON.stringify({ relay, state });
      await handler.tx.writeValue(new TextEncoder().encode(payload));
      return true;
    } catch {
      return false;
    }
  }

  function applyScenario(id: string) {
    const scenario = SCENARIOS.find(item => item.id === id);
    if (scenario) patch({ ...scenario.state, availableLoads: [...scenario.state.availableLoads] }, id);
  }

  async function analyze() {
    decisionRequest.current?.abort();
    const controller = new AbortController();
    decisionRequest.current = controller;
    const version = revision.current;
    setLoading(true);
    setAnalysisError(false);
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/api/ai/decision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDecisionRequest(sim)), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error("Decision unavailable");
      if (version === revision.current && decisionRequest.current === controller) setResult(data);
    } catch {
      if (version === revision.current && decisionRequest.current === controller) {
        setResult(null);
        setAnalysisError(true);
      }
    } finally {
      clearTimeout(timer);
      if (decisionRequest.current === controller) {
        decisionRequest.current = null;
        setLoading(false);
      }
    }
  }

  async function send(text: string) {
    const content = text.trim().slice(0, 1000);
    if (!content || chatRequest.current) return;
    // Reply in the language the user actually wrote (Arabic script → ar).
    const msgLang: Lang = /[؀-ۿ]/.test(content) ? "ar" : "en";
    const controller = new AbortController();
    chatRequest.current = controller;
    const state = buildDecisionRequest(sim);
    const snapshot = `${state.solarProductionW}W / ${state.consumptionW}W / ${state.battery.levelPercent}%`;
    const next: Message[] = [...messages, { role: "user" as const, content, snapshot, decision: decision.recommendedAction }].slice(-39);
    setMessages(next);
    setDraft("");
    setChatLoading(true);
    const timer = setTimeout(() => controller.abort(), 45000);
    // Empty assistant bubble appears instantly, then fills token by token.
    const base: Message[] = [...next, { role: "assistant" as const, content: "", snapshot, decision: decision.recommendedAction, live: true }].slice(-40);
    setMessages(base);
    const patchLive = (content: string, live: boolean, source?: "ai" | "fallback") =>
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.length - 1;
        const lastMsg = copy[idx];
        if (!lastMsg || lastMsg.role !== "assistant") return prev;
        copy[idx] = { ...lastMsg, content, live, ...(source ? { source } : {}) };
        return copy;
      });
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, signal: controller.signal,
        body: JSON.stringify({ state, decision: { recommendedAction: decision.recommendedAction, reason: decision.reason }, lang: msgLang,
          // API accepts at most 10 messages, each at most 1000 characters.
          messages: next.filter(message => !message.error).slice(-9).map(({ role, content: value }) => ({ role, content: value.slice(0, 1000) })),
        }),
      });
      if (!response.ok || !response.body) throw new Error("Chat unavailable");
      // Non-streaming JSON (tests, proxies): legacy contract path.
      if (!(response.headers.get("content-type") || "").includes("text/event-stream")) {
        const data = await response.json();
        if (!data?.success || typeof data.reply !== "string") throw new Error("Chat unavailable");
        setMessages([...next, { role: "assistant", content: data.reply, source: data.source === "ai" ? "ai" : "fallback", snapshot, decision: decision.recommendedAction }].slice(-40) as Message[]);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let settled = false;
      const finish = (content: string, source: "ai" | "fallback") => {
        if (settled) return;
        settled = true;
        patchLive(content, false, source);
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
            if (typeof evt.token === "string") {
              full += evt.token;
              patchLive(full, true, "ai");
            } else if (typeof evt.reply === "string") {
              finish(evt.reply, evt.source === "ai" ? "ai" : "fallback");
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
      if (!settled) {
        if (full.trim()) finish(full, "ai");
        else throw new Error("Chat unavailable");
      }
    } catch {
      setMessages([...next, { role: "assistant", content: msgLang === "ar" ? "لم يصلني رد. أعد إرسال سؤالك وسأجيبك فورًا." : "Could not get a reply. Send your question again to retry.", snapshot, error: true }].slice(-40) as Message[]);
    } finally {
      clearTimeout(timer);
      chatRequest.current = null;
      setChatLoading(false);
    }
  }

  return { lang, setLang, sim, calc, scenarioId, patch, applyScenario, result, decision, loading, analysisError, analyze,
    messages, draft, setDraft, chatLoading, send, clearChat: () => { if (!chatRequest.current) setMessages([]); },
    dataMode, serialStatus, connectSerial, disconnectSerial, live,
    bleStatus, bleReading, connectBluetooth, disconnectBluetooth, sendBluetoothCommand,
    deviceReading, deviceAt, deviceSource, history, decisionLog, relayState, setRelayCommand,
    studyTotals, resetStudy };
}

const SolarContext = createContext<ReturnType<typeof useSolarState> | null>(null);
export function SolarProvider({ children }: { children: React.ReactNode }) {
  const value = useSolarState();
  return <SolarContext.Provider value={value}>{children}</SolarContext.Provider>;
}
export function useSolar() {
  const value = useContext(SolarContext);
  if (!value) throw new Error("SolarProvider is required");
  return value;
}

interface SerialPortLike {
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

// Minimal Web Bluetooth typings (not in TypeScript's default DOM lib).
interface BluetoothCharacteristicLike extends EventTarget {
  value?: DataView | null;
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  stopNotifications(): Promise<BluetoothCharacteristicLike>;
  writeValue(value: BufferSource): Promise<void>;
}
interface BluetoothServiceLike {
  getCharacteristic(uuid: string): Promise<BluetoothCharacteristicLike>;
}
interface BluetoothServerLike {
  connected: boolean;
  connect(): Promise<BluetoothServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothServiceLike>;
}
interface BluetoothDeviceLike extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothServerLike;
}
interface BluetoothLike {
  requestDevice(options: {
    filters: { services: string[] }[];
    optionalServices?: string[];
  }): Promise<BluetoothDeviceLike>;
}

```

---

