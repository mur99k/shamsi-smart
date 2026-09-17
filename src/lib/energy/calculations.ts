import type { EnergyCalc, SystemStatus } from "./types";

/**
 * Energy Calculation Engine (§21).
 * Pure math — runs locally, NEVER delegated to the AI model.
 *
 *   netEnergyW     = solarProductionW − consumptionW   (signed)
 *   excessEnergyW  = max(netEnergyW, 0)
 *   energyShortageW = max(−netEnergyW, 0)
 *
 *   net > 0 → SURPLUS · net = 0 → BALANCED · net < 0 → SHORTAGE
 */
export function calculateEnergy(solarProductionW: number, consumptionW: number): EnergyCalc {
  const solar = Math.max(0, Math.round(solarProductionW));
  const load = Math.max(0, Math.round(consumptionW));
  const netEnergyW = solar - load;
  const excessEnergyW = Math.max(netEnergyW, 0);
  const energyShortageW = Math.max(-netEnergyW, 0);
  const status: SystemStatus =
    netEnergyW > 0 ? "SURPLUS" : netEnergyW === 0 ? "BALANCED" : "SHORTAGE";
  const selfCoveragePct = load <= 0 ? 100 : Math.min(100, Math.round((solar / load) * 100));
  return {
    solarProductionW: solar,
    consumptionW: load,
    netEnergyW,
    excessEnergyW,
    energyShortageW,
    status,
    selfCoveragePct,
  };
}
