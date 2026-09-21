import type { DecisionRequest } from "@/types/energy";

/** UI-friendly simulation knobs. The Decision Request Builder
 *  (buildDecisionRequest) converts this into validated AI input. */
export interface SimState {
  solarProductionW: number;
  consumptionW: number;
  batteryCapacityWh: number;
  batteryLevelPct: number;
  batteryAvailable: boolean;
  evAvailable: boolean;
  evCharging: boolean;
  availableLoads: string[];
  currentTime: string; // HH:MM
  futureSolarEstimateW: number;
}

export interface Scenario {
  id: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  state: SimState;
}

const base = (partial: Partial<SimState>): SimState => ({
  solarProductionW: 1000,
  consumptionW: 300,
  batteryCapacityWh: 5000,
  batteryLevelPct: 40,
  batteryAvailable: true,
  evAvailable: true,
  evCharging: false,
  availableLoads: ["Water Heater", "AC"],
  currentTime: "12:30",
  futureSolarEstimateW: 900,
  ...partial,
});

export const SCENARIOS: Scenario[] = [
  {
    id: "s1",
    nameEn: "High Surplus",
    nameAr: "فائض عالٍ",
    descEn: "1500W vs 300W · battery 20% · EV ready",
    descAr: "1500W مقابل 300W · بطارية 20% · سيارة جاهزة",
    state: base({ solarProductionW: 1500, consumptionW: 300, batteryLevelPct: 20, batteryAvailable: true, evAvailable: true, futureSolarEstimateW: 1400, currentTime: "12:30" }),
  },
  {
    id: "s2",
    nameEn: "Low Surplus",
    nameAr: "فائض منخفض",
    descEn: "500W vs 450W · battery 80% · EV ready",
    descAr: "500W مقابل 450W · بطارية 80% · سيارة جاهزة",
    state: base({ solarProductionW: 500, consumptionW: 450, batteryLevelPct: 80, batteryAvailable: true, evAvailable: true, futureSolarEstimateW: 300 }),
  },
  {
    id: "s3",
    nameEn: "Balanced",
    nameAr: "متوازن",
    descEn: "500W vs 500W · battery 60% · EV ready",
    descAr: "500W مقابل 500W · بطارية 60% · سيارة جاهزة",
    state: base({ solarProductionW: 500, consumptionW: 500, batteryLevelPct: 60, batteryAvailable: true, evAvailable: true, futureSolarEstimateW: 500, currentTime: "13:00" }),
  },
  {
    id: "s4",
    nameEn: "Shortage",
    nameAr: "عجز",
    descEn: "300W vs 700W · battery 60% · no EV",
    descAr: "300W مقابل 700W · بطارية 60% · لا سيارة",
    state: base({ solarProductionW: 300, consumptionW: 700, batteryLevelPct: 60, batteryAvailable: true, evAvailable: false, futureSolarEstimateW: 100, currentTime: "18:45" }),
  },
  {
    id: "s5",
    nameEn: "Full Battery",
    nameAr: "بطارية ممتلئة",
    descEn: "1200W vs 300W · battery 100% · EV ready",
    descAr: "1200W مقابل 300W · بطارية 100% · سيارة جاهزة",
    state: base({ solarProductionW: 1200, consumptionW: 300, batteryLevelPct: 100, batteryAvailable: true, evAvailable: true, futureSolarEstimateW: 1100 }),
  },
];

export const DEFAULT_SIM_STATE: SimState = { ...SCENARIOS[0].state };

export interface LoadPreset {
  id: string;
  en: string;
  ar: string;
  /** Typical draw in watts — a simulation example, not a measurement. */
  watts: number;
}

export const LOAD_PRESETS: LoadPreset[] = [
  { id: "Water Heater", en: "Water Heater", ar: "سخان المياه", watts: 1500 },
  { id: "AC", en: "AC", ar: "مكيف", watts: 1800 },
  { id: "Washing Machine", en: "Washing Machine", ar: "غسالة", watts: 900 },
  { id: "Water Pump", en: "Water Pump", ar: "مضخة مياه", watts: 750 },
  { id: "Heater", en: "Heater", ar: "مدفأة", watts: 1200 },
  { id: "Lighting", en: "Lighting", ar: "إضاءة", watts: 120 },
];

/** Sum of the example draws of the selected loads (simulation only). */
export function loadsCapacityW(ids: string[]): number {
  return ids.reduce((sum, id) => sum + (LOAD_PRESETS.find((l) => l.id === id)?.watts ?? 0), 0);
}

/**
 * Decision Request Builder — converts raw simulation knobs into the
 * validated AI input shape (§18). Math (excess) is computed here,
 * never by the model.
 */
export function buildDecisionRequest(s: SimState): DecisionRequest {
  const solar = Math.max(0, Math.round(s.solarProductionW));
  const load = Math.max(0, Math.round(s.consumptionW));
  const net = solar - load;
  const totalCapacityW = loadsCapacityW(s.availableLoads);
  const [hh = "12", mm = "30"] = (s.currentTime || "12:30").split(":");
  const today = new Date();
  const pad = (n: string) => n.padStart(2, "0");
  const currentTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}T${pad(hh)}:${pad(mm)}:00+03:00`;
  return {
    solarProductionW: solar,
    consumptionW: load,
    excessEnergyW: Math.max(net, 0),
    battery: {
      available: s.batteryAvailable,
      capacityWh: Math.max(0, Math.round(s.batteryCapacityWh)),
      levelPercent: Math.min(100, Math.max(0, Math.round(s.batteryLevelPct))),
    },
    ev: { available: s.evAvailable, charging: s.evCharging && s.evAvailable },
    loads: { available: totalCapacityW > 0, totalCapacityW },
    environment: {
      currentTime,
      estimatedSolarProductionNextHourW: Math.max(0, Math.round(s.futureSolarEstimateW)),
    },
  };
}
