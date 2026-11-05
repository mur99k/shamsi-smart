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
