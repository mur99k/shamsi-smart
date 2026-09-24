import { NextResponse } from "next/server";
import { prepareChat, fallbackReply, stripMarkdown, type ChatMessage } from "@/lib/ai/chat";
import { fallbackDecide } from "@/lib/ai/fallback";
import { resolveEndpoints, streamChatTokens } from "@/lib/ai/client";
import type { ApiError, DecisionRequest, RecommendedAction } from "@/types/energy";
import { RECOMMENDED_ACTIONS } from "@/types/energy";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bad = (message: string) =>
  NextResponse.json({ error: "INVALID_INPUT", message } satisfies ApiError, { status: 400 });

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * POST /api/ai/chat — server-side conversational assistant.
 * Every request carries the CURRENT SystemState; the server recomputes
 * energy math locally and grounds the model in that snapshot.
 * Body: { state: DecisionRequest, decision?: {recommendedAction, reason},
 *         lang?: "ar"|"en", messages: [{role, content}] }
 */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return bad("Request body must be valid JSON");
  }
  if (typeof b !== "object" || b === null) return bad("Request body must be an object");

  const s = b.state as Record<string, unknown> | undefined;
  if (typeof s !== "object" || s === null) return bad("state must be an object");
  if (!isNum(s.solarProductionW) || (s.solarProductionW as number) < 0)
    return bad("state.solarProductionW must be a number >= 0");
  if (!isNum(s.consumptionW) || (s.consumptionW as number) < 0)
    return bad("state.consumptionW must be a number >= 0");

  const bat = s.battery as Record<string, unknown> | undefined;
  const evv = s.ev as Record<string, unknown> | undefined;
  const lo = s.loads as Record<string, unknown> | undefined;
  if (typeof bat !== "object" || bat === null || typeof bat.available !== "boolean")
    return bad("state.battery.available must be boolean");
  if (!isNum(bat.capacityWh) || (bat.capacityWh as number) < 0)
    return bad("state.battery.capacityWh must be a number >= 0");
  if (!isNum(bat.levelPercent) || (bat.levelPercent as number) < 0 || (bat.levelPercent as number) > 100)
    return bad("state.battery.levelPercent must be between 0 and 100");
  if (typeof evv !== "object" || evv === null || typeof evv.available !== "boolean" || typeof evv.charging !== "boolean")
    return bad("state.ev.available and state.ev.charging must be boolean");
  if (typeof lo !== "object" || lo === null || typeof lo.available !== "boolean")
    return bad("state.loads.available must be boolean");
  if (!isNum(lo.totalCapacityW) || (lo.totalCapacityW as number) < 0)
    return bad("state.loads.totalCapacityW must be a number >= 0");

  const rawMsgs = b.messages;
  if (!Array.isArray(rawMsgs) || rawMsgs.length === 0) return bad("messages must be a non-empty array");
  if (rawMsgs.length > 10) return bad("messages must contain at most 10 entries");
  const messages: ChatMessage[] = [];
  for (const m of rawMsgs) {
    if (typeof m !== "object" || m === null) return bad("each message must be an object");
    const mm = m as Record<string, unknown>;
    if (mm.role !== "user" && mm.role !== "assistant") return bad("message role must be user or assistant");
    if (typeof mm.content !== "string" || !mm.content.trim()) return bad("message content must be a non-empty string");
    if (mm.content.length > 1000) return bad("message content must be at most 1000 characters");
    messages.push({ role: mm.role, content: mm.content });
  }
  if (messages[messages.length - 1].role !== "user") return bad("last message must be from the user");

  const lang: "ar" | "en" = b.lang === "en" ? "en" : "ar";
  const env = s.environment as Record<string, unknown> | undefined;

  const state: DecisionRequest = {
    solarProductionW: s.solarProductionW as number,
    consumptionW: s.consumptionW as number,
    excessEnergyW: Math.max(Math.round(s.solarProductionW as number) - Math.round(s.consumptionW as number), 0),
    battery: {
      available: bat.available as boolean,
      capacityWh: bat.capacityWh as number,
      levelPercent: bat.levelPercent as number,
    },
    ev: { available: evv.available as boolean, charging: evv.charging as boolean },
    loads: { available: lo.available as boolean, totalCapacityW: lo.totalCapacityW as number },
    environment:
      env && typeof env === "object"
        ? {
            currentTime: typeof env.currentTime === "string" ? env.currentTime : undefined,
            estimatedSolarProductionNextHourW: isNum(env.estimatedSolarProductionNextHourW)
              ? (env.estimatedSolarProductionNextHourW as number)
              : undefined,
          }
        : undefined,
  };

  const din = b.decision as Record<string, unknown> | undefined;
  const decision =
    din &&
    typeof din === "object" &&
    RECOMMENDED_ACTIONS.includes(din.recommendedAction as RecommendedAction) &&
    typeof din.reason === "string"
      ? { recommendedAction: din.recommendedAction as RecommendedAction, reason: din.reason as string }
      : undefined;

  const ctx = { state, decision, lang, messages };
  // Streaming clients (browsers) get tokens live; others get the JSON contract.
  if ((req.headers.get("accept") || "").includes("text/event-stream")) {
    const prep = await prepareChat(ctx);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        const sendFallback = () => {
          const fb = fallbackDecide(prep && state);
          const withDecision = { ...ctx, decision: { recommendedAction: fb.recommendedAction, reason: fb.reason } };
          send({ fallback: true, reply: fallbackReply(withDecision, prep.calculated, prep.weather), source: "fallback", calculated: prep.calculated });
        };
        try {
          if (!prep.apiKey || !prep.apiBase) {
            sendFallback();
          } else {
            const { chat } = resolveEndpoints(prep.apiBase);
            let full = "";
            let gotToken = false;
            const out = await streamChatTokens(chat, prep.apiKey, {
              model: prep.model,
              temperature: 0.3,
              max_tokens: 350,
              messages: [{ role: "system", content: prep.system }, ...prep.history],
            }, (t) => { gotToken = true; full += t; send({ token: t }); });
            if (!out || !gotToken || !full.trim()) {
              sendFallback();
            } else {
              send({ done: true, source: "ai", calculated: prep.calculated, reply: stripMarkdown(full).slice(0, 1200) });
            }
          }
        } catch {
          try { sendFallback(); } catch { /* client gone */ }
        } finally {
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const { chatReply } = await import("@/lib/ai/chat");
  const result = await chatReply(ctx).catch(() => null);
  if (!result) return NextResponse.json({ success: false, error: "SERVICE_UNAVAILABLE", message: "Assistant is temporarily unavailable. Please try again." }, { status: 503 });
  return NextResponse.json({ success: true, ...result }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/ai/chat",
    contract: "{ state, decision?, lang?, messages[] } → { success, reply, source, calculated }",
  });
}
