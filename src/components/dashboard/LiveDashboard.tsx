"use client";

import { useEffect, useState } from "react";
import { Activity, BatteryCharging, BatteryFull, BatteryLow, Cable, Bluetooth, Cloud, Gauge, History, Plug, PlugZap, RefreshCw, RotateCcw, Sun, TriangleAlert, Waves } from "lucide-react";
import { ACTION_META, type RecommendedAction } from "@/types/energy";
import { batteryState, liveDecision } from "@/lib/energy/live";
import { useSolar } from "./SolarProvider";

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
      <section className="live-shell">
        <div className="live-head">
          <h2><Activity size={18} aria-hidden="true" />{ar ? "لوحة المراقبة الحية" : "Live monitoring"}</h2>
          <span className="live-pill idle">{ar ? "لا توجد قراءة حية" : "No live reading"}</span>
        </div>
        <div className="live-empty">
          <Waves size={26} aria-hidden="true" />
          <h3>{ar ? "اربط وحدة ESP32 لعرض القراءات الحقيقية" : "Connect the ESP32 to see real readings"}</h3>
          <p className="muted">
            {ar
              ? "هذه اللوحة لا تعرض أي أرقام وهمية. صِل الجهاز عبر USB أو البلوتوث، أو انتظر وصول قراءة من السحابة."
              : "This panel never shows invented numbers. Connect over USB or Bluetooth, or wait for a cloud reading."}
          </p>
          <div className="live-actions">
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
            <p className="live-stale"><TriangleAlert size={14} aria-hidden="true" />{ar ? `آخر قراءة وصلت قبل ${Math.round(age / 1000)} ثانية — لا تُعرض كحالية.` : `Last reading arrived ${Math.round(age / 1000)}s ago — not shown as current.`}</p>
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
    <section className="live-shell">
      <div className="live-head">
        <h2><Activity size={18} aria-hidden="true" />{ar ? "لوحة المراقبة الحية" : "Live monitoring"}</h2>
        <span className={`live-pill ${fresh ? "on" : "idle"}`}>
          {fresh ? (ar ? `مباشر · ${srcLabel}` : `Live · ${srcLabel}`) : (ar ? "قديمة" : "Stale")}
        </span>
      </div>
      <p className="live-sub">
        {ar ? "آخر تحديث" : "Updated"} {fmtTime(deviceAt, ar)} · {ar ? "كل القيم من الجهاز" : "all values from the device"}
      </p>

      {/* Energy overview */}
      <div className="live-grid four">
        <div className="live-tile"><span><Sun size={15} />{ar ? "الإنتاج" : "Production"}</span><strong dir="ltr">{Math.round(deviceReading.solarW)} W</strong></div>
        <div className="live-tile"><span><Plug size={15} />{ar ? "الاستهلاك" : "Consumption"}</span><strong dir="ltr">{Math.round(deviceReading.loadW)} W</strong></div>
        <div className="live-tile"><span><Gauge size={15} />{ar ? "الصافي" : "Net"}</span><strong dir="ltr">{net > 0 ? "+" : ""}{Math.round(net)} W</strong></div>
        <div className="live-tile"><span><BatteryCharging size={15} />{ar ? "البطارية" : "Battery"}</span><strong dir="ltr">{deviceReading.batteryW !== null ? `${Math.round(deviceReading.batteryW)} W` : "—"}</strong></div>
      </div>

      <div className="live-row">
        <span className={`status-chip ${status.toLowerCase()}`}>{ar ? (status === "SURPLUS" ? "فائض" : status === "SHORTAGE" ? "عجز" : "توازن") : status}</span>
        <span className="live-mini">{ar ? "فائض" : "Surplus"} <b dir="ltr">{Math.round(surplus)} W</b></span>
        <span className="live-mini">{ar ? "عجز" : "Shortage"} <b dir="ltr">{Math.round(shortage)} W</b></span>
        {deviceReading.lux !== null && <span className="live-mini">{ar ? "الإضاءة" : "Light"} <b dir="ltr">{Math.round(deviceReading.lux)} lux</b></span>}
        {deviceReading.tempC !== null && <span className="live-mini">{ar ? "الحرارة" : "Temp"} <b dir="ltr">{deviceReading.tempC} °C</b></span>}
        {deviceReading.humidity !== null && <span className="live-mini">{ar ? "الرطوبة" : "Humidity"} <b dir="ltr">{deviceReading.humidity} %</b></span>}
      </div>

      <div className="live-grid two">
        {/* Battery */}
        <article className="live-card">
          <h3>{bstate.tone === "ok" ? <BatteryFull size={17} /> : bstate.tone === "bad" ? <BatteryLow size={17} /> : <BatteryCharging size={17} />}{ar ? "تحليل البطارية" : "Battery status"}</h3>
          <dl className="live-kv">
            <div><dt>{ar ? "نسبة الشحن" : "SOC"}</dt><dd dir="ltr">{deviceReading.batteryPct !== null ? `${Math.round(deviceReading.batteryPct)} %` : "—"}</dd></div>
            <div><dt>{ar ? "الجهد" : "Voltage"}</dt><dd dir="ltr">{deviceReading.batteryV !== null ? `${deviceReading.batteryV.toFixed(2)} V` : "—"}</dd></div>
            <div><dt>{ar ? "التيار" : "Current"}</dt><dd dir="ltr">{deviceReading.batteryA !== null ? `${deviceReading.batteryA.toFixed(0)} mA` : "—"}</dd></div>
            <div><dt>{ar ? "القدرة" : "Power"}</dt><dd dir="ltr">{deviceReading.batteryW !== null ? `${Math.round(deviceReading.batteryW)} W` : "—"}</dd></div>
          </dl>
          <span className={`batt-tone ${bstate.tone}`}>{bstate.label}</span>
          {(deviceReading.batteryV === null || deviceReading.batteryPct === null) && (
            <p className="muted small">
              {ar
                ? "الشرطة تعني «غير مقيس»: الجهد والتيار يصلان عبر USB أو البلوتوث فقط، ونسبة الشحن تحتاج BMS. لا نخترع رقمًا."
                : "A dash means “not measured”: voltage and current arrive over USB or Bluetooth only, and SOC needs a BMS. We never invent a number."}
            </p>
          )}
        </article>

        {/* Decision */}
        <article className="live-card rec">
          <h3><Gauge size={17} />{ar ? "قرار النظام" : "System decision"}</h3>
          <p className="live-decision">{ar ? ACTION_META[decision.action].labelAr : ACTION_META[decision.action].labelEn}</p>
          <p className="muted small">{decision.reason}</p>
        </article>
      </div>

      {/* Distribution */}
      <article className="live-card">
        <h3><Waves size={17} />{ar ? "توزيع الطاقة" : "Energy distribution"}</h3>
        <div className="dist">
          <div><span>{ar ? "استهلاك مباشر" : "Direct self-use"}</span><b dir="ltr">{Math.round(selfUsed)} W · {pct(selfUsed)}%</b><span className="dist-track"><i style={{ width: `${pct(selfUsed)}%` }} className="d1" /></span></div>
          <div><span>{ar ? "إلى البطارية" : "To battery"}</span><b dir="ltr">{Math.round(toBattery)} W · {toBattery ? pct(toBattery) : 0}%</b><span className="dist-track"><i style={{ width: `${toBattery ? pct(toBattery) : 0}%` }} className="d2" /></span></div>
          <div><span>{ar ? "فائض غير موجَّه" : "Un-routed surplus"}</span><b dir="ltr">{Math.round(exported)} W · {exported ? pct(exported) : 0}%</b><span className="dist-track"><i style={{ width: `${exported ? pct(exported) : 0}%` }} className="d3" /></span></div>
        </div>
        {deviceReading.relay === null && <p className="muted small">{ar ? "السيارة الكهربائية غير موصولة بهذه الوحدة." : "No EV channel on this unit."}</p>}
      </article>

      {/* Recommendation */}
      <article className="live-card recommend">
        <h3><PlugZap size={17} />{ar ? "التوصية" : "Recommendation"}</h3>
        <p>
          {status === "SHORTAGE"
            ? (ar ? "أوقف الحمل غير الأساسي الآن، واحتفظ بالبطارية للفترة الحرجة." : "Switch off non-essential loads now and keep the battery for the critical window.")
            : status === "BALANCED"
              ? (ar ? "المنظومة متوازنة — لا حاجة لإجراء، راقب فقط." : "Balanced — no action needed, just keep watching.")
              : toBattery > 5
                ? (ar ? "التخزين يعمل — لا تشغّل أحمالًا إضافية حتى تمتلئ البطارية." : "Storage is active — avoid extra loads until the battery fills.")
                : (ar ? "شغّل حملًا الآن (الريليه) بدل هدر الفائض." : "Run a relay load now instead of wasting the surplus.")}
        </p>
      </article>

      {/* Chart */}
      <article className="live-card">
        <h3><Activity size={17} />{ar ? "المراقبة المباشرة" : "Live trend"}</h3>
        {history.length < 2 ? (
          <p className="muted small">{ar ? "تنتظر عيّنات كافية لرسم المنحنى…" : "Waiting for enough samples to draw the trend…"}</p>
        ) : (
          <>
            <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={ar ? "منحنى الإنتاج والاستهلاك" : "Production and consumption trend"}>
              <polyline points="0,38 100,38" className="spark-base" />
              <path d={solarArea} className="spark-fill" />
              <path d={line("solarW")} className="spark-solar" />
              <path d={line("loadW")} className="spark-load" />
            </svg>
            <div className="spark-legend">
              <span><i className="k1" />{ar ? "إنتاج" : "Production"} · {Math.round(history[history.length - 1].solarW)} W</span>
              <span><i className="k2" />{ar ? "استهلاك" : "Consumption"} · {Math.round(history[history.length - 1].loadW)} W</span>
              <span className="muted">{history.length} {ar ? "عيّنة" : "samples"} · {ar ? "أقصى" : "peak"} {Math.round(maxPoint)} W</span>
            </div>
          </>
        )}
      </article>

      {/* Field-study metrics */}
      <article className="live-card study">
        <h3><History size={17} />{ar ? "مؤشرات الدراسة الميدانية" : "Field-study metrics"}</h3>
        <div className="live-grid four">
          <div className="live-tile"><span>{ar ? "مدة الجلسة" : "Session"}</span><strong dir="ltr">{sessionLabel}</strong></div>
          <div className="live-tile"><span>{ar ? "طاقة شمسية" : "Solar energy"}</span><strong dir="ltr">{kwh(studyTotals.solarWh)}</strong></div>
          <div className="live-tile"><span>{ar ? "استهلاك" : "Load energy"}</span><strong dir="ltr">{kwh(studyTotals.loadWh)}</strong></div>
          <div className="live-tile"><span>{ar ? "إلى البطارية" : "To battery"}</span><strong dir="ltr">{kwh(studyTotals.batteryWh)}</strong></div>
          <div className="live-tile"><span>{ar ? "الاستهلاك الذاتي" : "Self-consumption"}</span><strong dir="ltr">{selfConsumption !== null ? `${selfConsumption}%` : "—"}</strong></div>
          <div className="live-tile"><span>{ar ? "تغطية الاستهلاك" : "Coverage"}</span><strong dir="ltr">{coverage !== null ? `${coverage}%` : "—"}</strong></div>
          <div className="live-tile"><span>{ar ? "استيراد الذروة" : "Peak-hour import"}</span><strong dir="ltr">{kwh(studyTotals.peakImportWh)}</strong></div>
          <div className="live-tile"><span>{ar ? "إجمالي الاستيراد" : "Total import"}</span><strong dir="ltr">{kwh(studyTotals.importWh)}</strong></div>
        </div>
        <p className="muted small">
          {ar
            ? "تكامل زمني من القراءات الفعلية (Wh) — لا تقديرات. الجلسة الحالية فقط، والدراسة الميدانية تحتاج أسابيع. الذروة محسوبة بين 17:00 و22:00."
            : "Time-integrated from real readings (Wh) — no estimates. Current session only; the field study needs weeks. Peak window is 17:00–22:00."}
        </p>
        <button className="button" onClick={resetStudy}><RotateCcw size={15} />{ar ? "تصفير الجلسة" : "Reset session"}</button>
      </article>

      {/* Relay */}
      <article className="live-card">
        <h3><Plug size={17} />{ar ? "التحكم بالريليه (GPIO 19)" : "Relay control (GPIO 19)"}</h3>
        <div className="relay-row">
          <span className={`relay-state ${relayState}`}>{relayState === "on" ? (ar ? "يعمل" : "ON") : relayState === "off" ? (ar ? "متوقف" : "OFF") : (ar ? "غير معروف" : "Unknown")}</span>
          <button className="button primary" disabled={busy} onClick={() => void relay("on")}><PlugZap size={16} />{ar ? "تشغيل" : "Turn on"}</button>
          <button className="button" disabled={busy} onClick={() => void relay("off")}><Plug size={16} />{ar ? "إيقاف" : "Turn off"}</button>
        </div>
        <p className="muted small">
          {ar
            ? "الأمر يُرسل عبر القناة النشطة: بلوتوث ← USB ← سحابة. إن لم تصل قناة، يُدرج الأمر في طابور السحابة."
            : "The command uses the active channel: Bluetooth → USB → cloud. If none is live, it is queued in the cloud."}
        </p>
      </article>

      {/* Decision history */}
      <article className="live-card">
        <h3><History size={17} />{ar ? "سجل القرارات" : "Decision history"}</h3>
        {decisionLog.length === 0 ? (
          <p className="muted small">{ar ? "لا قرارات بعد — يبدأ السجل عند تغيّر حالة المنظومة." : "No decisions yet — the log starts when the system state changes."}</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>{ar ? "الوقت" : "Time"}</th><th>{ar ? "القرار" : "Decision"}</th><th>{ar ? "إنتاج/استهلاك" : "Prod/Load"}</th><th>{ar ? "المصدر" : "Source"}</th></tr></thead>
              <tbody>
                {decisionLog.map((d, i) => (
                  <tr key={`${d.at}-${i}`}>
                    <td dir="ltr">{fmtTime(d.at, ar)}</td>
                    <td>{ar ? ACTION_META[d.action as RecommendedAction].labelAr : ACTION_META[d.action as RecommendedAction].labelEn}</td>
                    <td dir="ltr">{Math.round(d.solarW)} / {Math.round(d.loadW)} W</td>
                    <td>{SOURCE_LABEL[d.source]?.[ar ? "ar" : "en"] ?? (ar ? "محاكاة" : "Simulation")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <div className="live-actions">
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
        <span className="live-mini"><Cloud size={14} /> {ar ? "السحابة تلقائية" : "Cloud automatic"} <RefreshCw size={12} /></span>
      </div>
    </section>
  );
}
