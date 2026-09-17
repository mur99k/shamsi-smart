// ─── Canonical API contract (§18 / §19) ────────────────────────────
// Single source of truth shared by route, engine, client builder and UI.
// NOTE: energy state words used in API responses are SURPLUS / BALANCED / SHORTAGE.

export const RECOMMENDED_ACTIONS = [
  "battery_storage",
  "ev_charging",
  "additional_load",
  "reduce_solar_input",
  "no_action",
  "energy_shortage",
] as const;

export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

export type SystemStatus = "SURPLUS" | "BALANCED" | "SHORTAGE";

export interface DecisionRequest {
  solarProductionW: number;
  consumptionW: number;
  excessEnergyW: number;
  battery: {
    available: boolean;
    capacityWh: number;
    levelPercent: number;
  };
  ev: {
    available: boolean;
    charging: boolean;
  };
  loads: {
    available: boolean;
    totalCapacityW: number;
  };
  environment?: {
    currentTime?: string;
    estimatedSolarProductionNextHourW?: number;
  };
}

export interface DecisionResponse {
  success: true;
  decision: {
    recommendedAction: RecommendedAction;
    reason: string;
    confidence: number | null;
  };
  calculated: {
    solarProductionW: number;
    consumptionW: number;
    excessEnergyW: number;
    netEnergyW: number;
    energyShortageW: number;
    status: SystemStatus;
  };
  source: "ai" | "fallback";
}

export interface ApiError {
  error: "INVALID_INPUT";
  message: string;
}

export const ACTION_META: Record<RecommendedAction, { icon: string; labelEn: string; labelAr: string }> = {
  battery_storage: { icon: "🔋", labelEn: "Charge Battery", labelAr: "شحن البطارية" },
  ev_charging: { icon: "🚗", labelEn: "Charge EV", labelAr: "شحن السيارة الكهربائية" },
  additional_load: { icon: "⚙️", labelEn: "Power Additional Load", labelAr: "تشغيل حمل إضافي" },
  reduce_solar_input: { icon: "🔻", labelEn: "Reduce Solar Input", labelAr: "تقليل دخل الطاقة الشمسية" },
  no_action: { icon: "✅", labelEn: "No Action", labelAr: "لا إجراء" },
  energy_shortage: { icon: "🪫", labelEn: "Energy Shortage", labelAr: "عجز في الطاقة" },
};
