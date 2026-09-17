// Energy domain types — re-exports the canonical contract plus
// internal calculation shapes. Calculations live in calculations.ts.
export type {
  DecisionRequest,
  DecisionResponse,
  RecommendedAction,
  SystemStatus,
  ApiError,
} from "@/types/energy";
export { RECOMMENDED_ACTIONS, ACTION_META } from "@/types/energy";

export interface EnergyCalc {
  solarProductionW: number;
  consumptionW: number;
  /** Raw signed difference: production − consumption (§21). */
  netEnergyW: number;
  /** max(net, 0) (§21). */
  excessEnergyW: number;
  /** max(−net, 0) (§21). */
  energyShortageW: number;
  status: import("@/types/energy").SystemStatus;
  /** 0–100, capped solar/load coverage helper for the UI. */
  selfCoveragePct: number;
}
