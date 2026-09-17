import { RECOMMENDED_ACTIONS, type DecisionRequest } from "@/types/energy";

/**
 * Prompt builder — constrains the model to the 6-action enum and
 * strict JSON. The model NEVER computes energy math; all numbers
 * are supplied pre-computed.
 */
export function buildDecisionPrompt(req: DecisionRequest): string {
  return [
    "You are an Energy Management Decision Engine for a solar prototype (simulation, not a real grid). You are NOT a chatbot — output a decision, not a conversation.",
    "Your task: analyse the energy snapshot, compare the available options, and choose EXACTLY ONE recommendedAction from:",
    RECOMMENDED_ACTIONS.join(", "),
    "",
    "Hard constraints:",
    "- Use the pre-computed numbers as-is. NEVER recalculate net/excess/shortage and NEVER invent data.",
    "- NEVER return an action outside the allowed list.",
    "- NEVER claim guaranteed savings or real-world efficiency (prototype).",
    "",
    "Guidance (advisory, final choice is yours based on the full snapshot):",
    "- excessEnergyW > 0 + battery.available + levelPercent < 80 → battery_storage.",
    "- battery full/unavailable + ev.available + not charging → ev_charging.",
    "- no storage/EV sink + loads.available → additional_load.",
    "- tiny surplus with NO useful sink → reduce_solar_input (last resort).",
    "- excessEnergyW == 0 and balanced → no_action.",
    "- excessEnergyW == 0 with consumption uncovered → energy_shortage.",
    "",
    "Respond with STRICT JSON only — no markdown, no prose:",
    '{"recommendedAction":"...","reason":"...","confidence":0.0-1.0 or null}',
    "- reason: one concise English sentence, no efficiency guarantees (prototype).",
    "- confidence: 0..1 when genuinely estimable, else null. Never invent precision.",
    "",
    `Snapshot: solar=${req.solarProductionW}W, consumption=${req.consumptionW}W, excess=${req.excessEnergyW}W, ` +
      `battery(avail=${req.battery.available}, level=${req.battery.levelPercent}%, cap=${req.battery.capacityWh}Wh), ` +
      `ev(avail=${req.ev.available}, charging=${req.ev.charging}), ` +
      `loads(avail=${req.loads.available}, cap=${req.loads.totalCapacityW}W), ` +
      `time=${req.environment?.currentTime ?? "n/a"}, nextHourSolar≈${req.environment?.estimatedSolarProductionNextHourW ?? "n/a"}W.`,
  ].join("\n");
}

export const AI_SYSTEM_PROMPT =
  "You output strict JSON for a solar energy decision engine. No prose outside JSON.";
