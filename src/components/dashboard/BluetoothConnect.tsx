"use client";

import { Bluetooth, LoaderCircle, PlugZap, Plug, Signal, Smartphone } from "lucide-react";
import { useSolar } from "./SolarProvider";

/** Direct wireless link (BLE UART) between the ESP32 and this dashboard.
 * No router, no cloud — the browser talks to the board over Bluetooth. */
export default function BluetoothConnect() {
  const { lang, bleStatus, bleReading, connectBluetooth, disconnectBluetooth, sendBluetoothCommand } = useSolar();
  const ar = lang === "ar";
  const connected = bleStatus === "connected";
  const unsupported = bleStatus === "unsupported";

  const badge = unsupported
    ? (ar ? "غير مدعوم" : "Unsupported")
    : connected
      ? (ar ? "متصل 🟢" : "Connected 🟢")
      : (ar ? "غير متصل" : "Disconnected");

  return (
    <section className="ble-panel">
      <div className="ble-head">
        <div>
          <h2><Bluetooth size={19} aria-hidden="true" />{ar ? "اتصال لاسلكي مباشر (Bluetooth)" : "Direct wireless link (Bluetooth)"}</h2>
          <p className="small muted">
            {ar
              ? "اربط لوح ESP32 مباشرة عبر البلوتوث — بدون راوتر ولا إنترنت. القراءات تصل للوحة فور استقبالها."
              : "Pair the ESP32 over Bluetooth — no router, no internet. Readings land on the dashboard as they arrive."}
          </p>
        </div>
        <span className={`ble-status ${connected ? "is-on" : ""}`}>{badge}</span>
      </div>

      {unsupported ? (
        <p className="ble-note">
          <Smartphone size={15} aria-hidden="true" />
          {ar
            ? "متصفحك لا يدعم Web Bluetooth. استخدم Chrome على Android أو Chrome/Edge على الكمبيوتر."
            : "Your browser has no Web Bluetooth. Use Chrome on Android, or Chrome/Edge on desktop."}
        </p>
      ) : (
        <div className="ble-actions">
          {!connected ? (
            <button className="button primary" onClick={() => void connectBluetooth()} disabled={bleStatus === "connecting"}>
              {bleStatus === "connecting" ? <LoaderCircle className="spin" size={16} /> : <Bluetooth size={16} />}
              {bleStatus === "connecting" ? (ar ? "جارٍ الاتصال..." : "Connecting...") : (ar ? "اتصل بلوح ESP32" : "Pair with ESP32")}
            </button>
          ) : (
            <>
              <button className="button" onClick={() => void sendBluetoothCommand("loads", "on")}><PlugZap size={16} />{ar ? "تشغيل الحمل" : "Turn load on"}</button>
              <button className="button" onClick={() => void sendBluetoothCommand("loads", "off")}><Plug size={16} />{ar ? "إيقاف الحمل" : "Turn load off"}</button>
              <button className="button" onClick={disconnectBluetooth}>{ar ? "فصل الاتصال" : "Disconnect"}</button>
            </>
          )}
        </div>
      )}

      {bleReading && (
        <dl className="ble-readings">
          <div><dt>{ar ? "الإنتاج" : "Solar"}</dt><dd dir="ltr" className="num">{bleReading.solarW} W</dd></div>
          <div><dt>{ar ? "الاستهلاك" : "Load"}</dt><dd dir="ltr" className="num">{bleReading.consumptionW} W</dd></div>
          {bleReading.lux !== null && <div><dt>{ar ? "الإضاءة" : "Light"}</dt><dd dir="ltr" className="num">{bleReading.lux} lux</dd></div>}
          {bleReading.tempC !== null && <div><dt>{ar ? "الحرارة" : "Temp"}</dt><dd dir="ltr" className="num">{bleReading.tempC} °C</dd></div>}
          <div><dt>{ar ? "الريليه" : "Relay"}</dt><dd dir="ltr" className="num">{bleReading.relay === "on" ? (ar ? "ON" : "ON") : (ar ? "OFF" : "OFF")}</dd></div>
        </dl>
      )}

      <p className="ble-note">
        <Signal size={15} aria-hidden="true" />
        {ar
          ? "مدى البلوتوث نحو 10 أمتار — مثالي لعرض بجهازك أمام اللجنة مباشرة."
          : "Bluetooth range is roughly 10 m — ideal for demonstrating the board live in front of the judges."}
      </p>
    </section>
  );
}
