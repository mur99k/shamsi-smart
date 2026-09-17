import { NextResponse } from "next/server";
import { aiConfigured, decide } from "@/lib/ai/decision";
import type { ApiError, DecisionRequest } from "@/types/energy";

const bad = (message: string) =>
  NextResponse.json({ error: "INVALID_INPUT", message } satisfies ApiError, { status: 400 });

function isNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * POST /api/ai/decision (§18 / §19)
 * Server-side only — the only place CODEX_API_KEY is ever read.
 * Validates the request, recomputes math locally, then returns a
 * validated structured decision ({ success, decision, calculated, source }).
 */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return bad("Request body must be valid JSON");
  }
  if (typeof b !== "object" || b === null) return bad("Request body must be an object");

  const { solarProductionW, consumptionW, excessEnergyW, battery, ev, loads, environment } = b as Record<string, unknown>;

  if (!isNum(solarProductionW) || solarProductionW < 0)
    return bad("solarProductionW must be a number >= 0");
  if (!isNum(consumptionW) || consumptionW < 0)
    return bad("consumptionW must be a number >= 0");
  if (!isNum(excessEnergyW))
    return bad("excessEnergyW must be a number");

  // Compatibility: excess must equal max(production − consumption, 0)
  const expectedExcess = Math.max(
    Math.round(solarProductionW) - Math.round(consumptionW),
    0,
  );
  if (Math.round(excessEnergyW) !== expectedExcess)
    return bad(
      `excessEnergyW (${excessEnergyW}) is inconsistent with solarProductionW - consumptionW (expected ${expectedExcess})`,
    );

  if (typeof battery !== "object" || battery === null) return bad("battery must be an object");
  const bat = battery as Record<string, unknown>;
  if (typeof bat.available !== "boolean") return bad("battery.available must be boolean");
  if (!isNum(bat.capacityWh) || bat.capacityWh < 0)
    return bad("battery.capacityWh must be a number >= 0");
  if (!isNum(bat.levelPercent) || bat.levelPercent < 0 || bat.levelPercent > 100)
    return bad("battery.levelPercent must be between 0 and 100");

  if (typeof ev !== "object" || ev === null) return bad("ev must be an object");
  const evv = ev as Record<string, unknown>;
  if (typeof evv.available !== "boolean") return bad("ev.available must be boolean");
  if (typeof evv.charging !== "boolean") return bad("ev.charging must be boolean");

  if (typeof loads !== "object" || loads === null) return bad("loads must be an object");
  const lo = loads as Record<string, unknown>;
  if (typeof lo.available !== "boolean") return bad("loads.available must be boolean");
  if (!isNum(lo.totalCapacityW) || lo.totalCapacityW < 0)
    return bad("loads.totalCapacityW must be a number >= 0");

  // environment is optional
  let env: DecisionRequest["environment"];
  if (environment !== undefined) {
    if (typeof environment !== "object" || environment === null)
      return bad("environment must be an object when provided");
    const e = environment as Record<string, unknown>;
    if (e.currentTime !== undefined && typeof e.currentTime !== "string")
      return bad("environment.currentTime must be a string");
    if (
      e.estimatedSolarProductionNextHourW !== undefined &&
      (!isNum(e.estimatedSolarProductionNextHourW) ||
        e.estimatedSolarProductionNextHourW < 0)
    )
      return bad("environment.estimatedSolarProductionNextHourW must be a number >= 0");
    env = {
      currentTime: e.currentTime as string | undefined,
      estimatedSolarProductionNextHourW: e.estimatedSolarProductionNextHourW as number | undefined,
    };
  }

  const decisionReq: DecisionRequest = {
    solarProductionW,
    consumptionW,
    excessEnergyW: expectedExcess,
    battery: {
      available: bat.available as boolean,
      capacityWh: bat.capacityWh as number,
      levelPercent: bat.levelPercent as number,
    },
    ev: { available: evv.available as boolean, charging: evv.charging as boolean },
    loads: { available: lo.available as boolean, totalCapacityW: lo.totalCapacityW as number },
    environment: env,
  };

  const result = await decide(decisionReq);
  // The API key is never included in any response (AC-06).
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/ai/decision",
    aiConfigured: aiConfigured(),
    contract: "§18 request → §19 response { success, decision, calculated, source }",
  });
}
