import type { DecisionRequest, RecommendedAction } from "@/types/energy";
import { calculateEnergy } from "@/lib/energy/calculations";

/**
 * Fallback Decision Engine (§20) — client-safe, zero Node deps.
 * Deterministic, tunable, local. Used when AI is unconfigured,
 * unreachable, or returns invalid output.
 *
 *   IF net < 0                                      → energy_shortage
 *   ELSE IF net = 0                                  → no_action
 *   ELSE IF battery.available AND capacity > 0 AND level < 80 → battery_storage
 *   ELSE IF ev.available AND !charging               → ev_charging
 *   ELSE IF loads.available AND totalCapacityW > 0   → additional_load
 *   ELSE                                             → reduce_solar_input
 */
export function fallbackDecide(req: DecisionRequest): {
  recommendedAction: RecommendedAction;
  reason: string;
} {
  const { battery, ev, loads } = req;
  const { netEnergyW: net, excessEnergyW: excess } = calculateEnergy(req.solarProductionW, req.consumptionW);
  if (net < 0) {
    return {
      recommendedAction: "energy_shortage",
      reason: `Consumption exceeds solar production by ${-net}W. No surplus to redirect; reduce non-essential loads.`,
    };
  }
  if (net === 0) return { recommendedAction: "no_action", reason: "Solar production equals consumption. No surplus or shortage; no action is needed." };
  if (battery.available && battery.capacityWh > 0 && battery.levelPercent < 80) {
    return {
      recommendedAction: "battery_storage",
      reason: `There is ${excess}W of excess energy and the battery is at ${battery.levelPercent}%. Storing first preserves energy for later shortage periods.`,
    };
  }
  if (ev.available && !ev.charging) {
    return {
      recommendedAction: "ev_charging",
      reason: `Battery is unavailable, has zero capacity, or is at the 80% storage threshold. ${excess}W surplus remains; recommend the available EV that is not already charging.`,
    };
  }
  if (loads.available && loads.totalCapacityW > 0) {
    return {
      recommendedAction: "additional_load",
      reason: `Storage and EV cannot absorb the surplus. ${excess}W can run available loads (capacity ${loads.totalCapacityW}W) instead of being wasted.`,
    };
  }
  return {
    recommendedAction: "reduce_solar_input",
    reason: `Surplus of ${excess}W remains with no eligible battery, idle EV or additional load. Recommend reducing solar input; this advisory policy does not send an inverter command.`,
  };
}
