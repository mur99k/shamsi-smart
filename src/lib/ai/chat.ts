import { calculateEnergy } from "@/lib/energy/calculations";
import type { RecommendedAction } from "@/types/energy";
import { fallbackDecide } from "./fallback";
import { postJson, resolveEndpoints } from "./client";
import type { DecisionRequest } from "./types";

/**
 * Server-only conversational layer — the AI Energy Assistant.
 * Shares the SAME SystemState + Energy Engine as the Decision Engine;
 * every reply is grounded in the snapshot sent with the request.
 * NEVER import from Client Components (reads CODEX_API_KEY).
 */
if (typeof window !== "undefined") {
  throw new Error("lib/ai/chat is server-only — never import from Client Components.");
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  state: DecisionRequest;
  decision?: { recommendedAction: RecommendedAction; reason: string };
  lang: "ar" | "en";
  messages: ChatMessage[];
}

function buildChatSystemPrompt(
  state: DecisionRequest,
  net: number,
  excess: number,
  shortage: number,
  status: string,
  decision: ChatContext["decision"],
  lang: "ar" | "en",
): string {
  return [
    "You are the Energy Management Decision Assistant inside a solar-energy prototype dashboard (SIMULATION — no real hardware is connected unless the UI explicitly shows ESP32 live mode).",
    "You discuss the SAME live system snapshot shown on screen. You are a focused engineering assistant, not a general chatbot. Rules:",
    "1. Never invent data, sensors, measurements, or results. Use ONLY the snapshot below.",
    "2. If hardware is mentioned, state clearly this build is software simulation; hardware (ESP32/Arduino/sensors) is a planned future stage, not present.",
    "3. Never claim measured savings, efficiency gains, or accuracy metrics. Model confidence is not scientific accuracy.",
    "4. Use the pre-computed net/excess/shortage as-is; do not recalculate differently.",
    "5. Explain decisions in plain language. You are an assistant, not a certified electrician or engineer.",
    "6. Clearly separate simulation from reality when relevant.",
    "7. If the user asks about a state you were not given (e.g. 'battery at 90%' while it is 40%), answer conditionally: explain what WOULD change, and name the missing/changed inputs.",
    "8. Keep replies short (2-4 sentences). No markdown tables, no chain-of-thought.",
    `9. Reply in ${lang === "ar" ? "Arabic (simple, direct)" : "English (simple, direct)"}.`,
    "10. Refuse unrelated questions (food, sports, entertainment, jokes, general trivia or personal topics) briefly and redirect to solar production, consumption, batteries, EVs, loads, telemetry or energy decisions.",
    "11. If asked about weather or temperature, do NOT stop at saying weather data or sensors are unavailable. Give the engineering impact immediately: high temperature can reduce PV output through the panel temperature coefficient and increase cooling/AC demand, which can reduce surplus; recommend shifting flexible cooling loads or using available surplus according to the current state. Clearly label this as a general engineering effect, not a measured local weather reading.",
    "12. For any external factor, connect it to electricity distribution and the current snapshot. Do not invent a temperature, forecast or sensor reading.",
    "",
    "CURRENT SYSTEM SNAPSHOT (live, authoritative):",
    `solarProductionW=${state.solarProductionW}, consumptionW=${state.consumptionW}, netEnergyW=${net}, excessEnergyW=${excess}, energyShortageW=${shortage}, status=${status}`,
    `battery(available=${state.battery.available}, level=${state.battery.levelPercent}%, capacity=${state.battery.capacityWh}Wh)`,
    `ev(available=${state.ev.available}, charging=${state.ev.charging})`,
    `loads(available=${state.loads.available}, totalCapacity=${state.loads.totalCapacityW}W)`,
    `currentTime=${state.environment?.currentTime ?? "n/a"}, estimatedNextHourSolar=${state.environment?.estimatedSolarProductionNextHourW ?? "n/a"}W`,
    decision
      ? `CURRENT DECISION UNDER DISCUSSION: ${decision.recommendedAction} — "${decision.reason}"`
      : "No decision has been computed yet for this snapshot.",
  ].join("\n");
}

/** Deterministic local answer when the AI is unreachable (never crashes). */
function fallbackReply(ctx: ChatContext, calc: { net: number; excess: number; shortage: number; status: string }): string {
  const s = ctx.state;
  const ar = ctx.lang === "ar";
  const where =
    ctx.decision?.recommendedAction === "battery_storage"
      ? ar ? "تخزين الفائض في البطارية" : "storing the surplus in the battery"
      : ctx.decision?.recommendedAction === "ev_charging"
        ? ar ? "شحن السيارة الكهربائية" : "charging the EV"
        : ctx.decision?.recommendedAction === "additional_load"
          ? ar ? "تشغيل حمل إضافي" : "running an additional load"
          : ctx.decision?.recommendedAction === "energy_shortage"
            ? ar ? "التعامل مع العجز بتقليل الأحمال" : "handling the shortage by reducing loads"
            : ctx.decision?.recommendedAction === "reduce_solar_input"
              ? ar ? "تقليل الإنتاج الشمسي لعدم وجود وجهة مؤهلة للفائض، دون أمر تحكم فعلي" : "reducing solar input because no eligible surplus sink is available, without a physical control command"
              : ar ? "الحفاظ على الوضع الحالي" : "holding the current state";
  return ar
    ? `حالة النظام الآن: الإنتاج ${s.solarProductionW}W والاستهلاك ${s.consumptionW}W، والصافي ${calc.net >= 0 ? "+" : ""}${calc.net}W (${calc.status}). البطارية عند ${s.battery.levelPercent}%. التوصية المحلية الحالية: ${where}. (رد محلي — تعذّر الوصول لنموذج الذكاء الاصطناعي.)`
    : `Current state: production ${s.solarProductionW}W, consumption ${s.consumptionW}W, net ${calc.net >= 0 ? "+" : ""}${calc.net}W (${calc.status}). Battery at ${s.battery.levelPercent}%. Local recommendation: ${where}. (Local reply — AI model unreachable.)`;
}

export async function chatReply(ctx: ChatContext): Promise<{
  reply: string;
  source: "ai" | "fallback";
  calculated: { net: number; excess: number; shortage: number; status: string };
}> {
  const calc = calculateEnergy(ctx.state.solarProductionW, ctx.state.consumptionW);
  const calculated = {
    net: calc.netEnergyW,
    excess: calc.excessEnergyW,
    shortage: calc.energyShortageW,
    status: calc.status,
  };

  const apiKey = process.env.CODEX_API_KEY?.trim();
  const apiBase = process.env.CODEX_API_URL?.trim();
  const model = process.env.CODEX_MODEL?.trim() || "gpt-5.6-sol";
  if (!apiKey || !apiBase) {
    return { reply: fallbackReply(ctx, calculated), source: "fallback", calculated };
  }

  const history = ctx.messages.slice(-8).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 1000),
  }));
  const system = buildChatSystemPrompt(ctx.state, calc.netEnergyW, calc.excessEnergyW, calc.energyShortageW, calc.status, ctx.decision, ctx.lang);

  try {
    const { chat } = resolveEndpoints(apiBase);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let res: { status: number; json: unknown };
    try {
      res = await postJson(chat, apiKey, {
        model,
        temperature: 0.3,
        max_tokens: 300,
        messages: [{ role: "system", content: system }, ...history],
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status !== 200) {
      // Deterministic local fallback keeps the strongest guarantee: same state
      const fb = fallbackDecide(ctx.state);
      return {
        reply: fallbackReply({ ...ctx, decision: { recommendedAction: fb.recommendedAction, reason: fb.reason } }, calculated),
        source: "fallback",
        calculated,
      };
    }
    const d = res.json as Record<string, unknown>;
    const choices = d?.choices as Array<Record<string, unknown>> | undefined;
    const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
    const text = typeof msg?.content === "string" ? msg.content.trim().slice(0, 1200) : "";
    if (!text) {
      const fb = fallbackDecide(ctx.state);
      return {
        reply: fallbackReply({ ...ctx, decision: { recommendedAction: fb.recommendedAction, reason: fb.reason } }, calculated),
        source: "fallback",
        calculated,
      };
    }
    return { reply: text, source: "ai", calculated };
  } catch {
    const fb = fallbackDecide(ctx.state);
    return {
      reply: fallbackReply({ ...ctx, decision: { recommendedAction: fb.recommendedAction, reason: fb.reason } }, calculated),
      source: "fallback",
      calculated,
    };
  }
}
