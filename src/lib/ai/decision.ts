import { calculateEnergy } from "@/lib/energy/calculations";
import type { DecisionRequest, DecisionResponse } from "@/types/energy";
import { callCodexDecider } from "./client";
import { fallbackDecide } from "./fallback";

/** Orchestrator: AI first, validated — else fallback. Never throws. */
export async function decide(req: DecisionRequest): Promise<DecisionResponse> {
  const calc = calculateEnergy(req.solarProductionW, req.consumptionW);
  const calculated = {
    solarProductionW: calc.solarProductionW,
    consumptionW: calc.consumptionW,
    excessEnergyW: calc.excessEnergyW,
    netEnergyW: calc.netEnergyW,
    energyShortageW: calc.energyShortageW,
    status: calc.status,
  };

  const ai = await callCodexDecider(req);
  if (ai.ok && ai.decision) {
    return {
      success: true,
      decision: {
        recommendedAction: ai.decision.recommendedAction,
        reason: ai.decision.reason,
        confidence: ai.decision.confidence,
      },
      calculated,
      source: "ai",
    };
  }

  const fb = fallbackDecide(req);
  return {
    success: true,
    decision: { recommendedAction: fb.recommendedAction, reason: fb.reason, confidence: null },
    calculated,
    source: "fallback",
  };
}

export function aiConfigured(): boolean {
  return !!(process.env.CODEX_API_KEY?.trim() && process.env.CODEX_API_URL?.trim());
}
