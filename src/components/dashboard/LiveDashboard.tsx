"use client";

import { useEffect, useState } from "react";
import { Activity, BatteryCharging, BatteryFull, BatteryLow, Cable, Bluetooth, Cloud, Gauge, History, Plug, PlugZap, RefreshCw, RotateCcw, Sun, TriangleAlert, Waves } from "lucide-react";
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
        <button className="button mt-2" onClick={resetStudy}><RotateCcw size={15} />{ar ? "تصفير الجلسة" : "Reset session"}</button>
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
