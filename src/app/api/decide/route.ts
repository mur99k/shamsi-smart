import { NextResponse } from "next/server";
import { decide } from "@/lib/ai/decision";
import { calculateEnergy } from "@/lib/energy/calculations";
import type { DecisionRequest } from "@/types/energy";

/**
 * @deprecated Use POST /api/ai/decision (§18 contract) instead.
 * Compatibility shim: accepts the legacy flat SystemState shape and
 * delegates to the same Decision Engine (no duplicated logic).
 */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const solar = Number(b?.solarProductionW ?? 1000);
    const load = Number(b?.consumptionW ?? 300);
    const calc = calculateEnergy(solar, load);
    const loadsArr: string[] = Array.isArray(b?.availableLoads) ? b.availableLoads : [];
    const decisionReq: DecisionRequest = {
      solarProductionW: calc.solarProductionW,
      consumptionW: calc.consumptionW,
      excessEnergyW: calc.excessEnergyW,
      battery: {
        available: b?.batteryAvailable !== false,
        capacityWh: Math.max(0, Number(b?.batteryCapacityWh ?? 5000)),
        levelPercent: Math.min(100, Math.max(0, Number(b?.batteryLevelPct ?? 40))),
      },
      ev: { available: b?.evAvailable === true, charging: false },
      loads: { available: loadsArr.length > 0, totalCapacityW: loadsArr.length * 400 },
      environment: {
        currentTime: typeof b?.currentTime === "string" ? b.currentTime : undefined,
        estimatedSolarProductionNextHourW:
          b?.futureSolarEstimateW !== undefined ? Number(b.futureSolarEstimateW) : undefined,
      },
    };
    const result = await decide(decisionReq);
    return NextResponse.json({
      calc: {
        excessW: result.calculated.excessEnergyW,
        status:
          result.calculated.status === "SURPLUS"
            ? "surplus"
            : result.calculated.status === "SHORTAGE"
              ? "deficit"
              : "balanced",
        solarProductionW: result.calculated.solarProductionW,
        consumptionW: result.calculated.consumptionW,
        selfCoveragePct: calc.selfCoveragePct,
      },
      decision: {
        recommendedAction: result.decision.recommendedAction,
        reason: result.decision.reason,
        confidence: result.decision.confidence,
        source: result.source,
      },
      meta: { aiConfigured: false, latencyMs: 0, note: "Deprecated: use POST /api/ai/decision." },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    deprecated: true,
    useInstead: "POST /api/ai/decision",
  });
}
