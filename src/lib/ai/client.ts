import { RECOMMENDED_ACTIONS, type RecommendedAction } from "@/types/energy";
import { AI_SYSTEM_PROMPT, buildDecisionPrompt } from "./prompts";
import type { AiProviderResult, DecisionRequest, ValidatedModelDecision } from "./types";

/**
 * Server-only Codex Everywhere client (OpenAI-compatible).
 * Reads CODEX_API_KEY / CODEX_API_URL / CODEX_MODEL from server env.
 * NEVER import this module from a Client Component.
 *
 * CODEX_API_URL is the provider BASE (e.g. https://codex-easy.ai/v1);
 * a full ".../chat/completions" or ".../responses" endpoint is also accepted.
 * Strategy: Chat Completions w/ structured output first, then Responses API.
 */
if (typeof window !== "undefined") {
  throw new Error("lib/ai/client is server-only — never import from Client Components.");
}

const TIMEOUT_MS = 9000;

const DECISION_JSON_SCHEMA = {
  name: "energy_decision",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      recommendedAction: { type: "string", enum: [...RECOMMENDED_ACTIONS] },
      reason: { type: "string" },
      confidence: { type: ["number", "null"] },
    },
    required: ["recommendedAction", "reason", "confidence"],
  },
};

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    return typeof obj === "object" && obj !== null ? obj : null;
  } catch {
    return null;
  }
}

/** Validate model output BEFORE it ever reaches the frontend. */
export function validateModelDecision(raw: unknown): ValidatedModelDecision | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!RECOMMENDED_ACTIONS.includes(r.recommendedAction as RecommendedAction)) return null;
  const reason =
    typeof r.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 500) : null;
  if (!reason) return null;
  const c = r.confidence;
  const confidence =
    typeof c === "number" && Number.isFinite(c) && c >= 0 && c <= 1 ? c : null;
  return { recommendedAction: r.recommendedAction as RecommendedAction, reason, confidence };
}

export function resolveEndpoints(baseOrEndpoint: string): { chat: string; responses: string } {
  const v = baseOrEndpoint.replace(/\/$/, "");
  if (v.endsWith("/chat/completions")) return { chat: v, responses: v.replace(/\/chat\/completions$/, "/responses") };
  if (v.endsWith("/responses")) return { chat: v.replace(/\/responses$/, "/chat/completions"), responses: v };
  return { chat: `${v}/chat/completions`, responses: `${v}/responses` };
}

export async function postJson(url: string, key: string, body: unknown): Promise<{ status: number; json: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function extractChatText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as Record<string, unknown>;
  const choices = d.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  const content = msg?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "object" && p !== null ? String((p as Record<string, unknown>).text ?? "") : ""))
      .join("");
  }
  return "";
}

function extractResponsesText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as Record<string, unknown>;
  if (typeof d.output_text === "string" && d.output_text) return d.output_text;
  const out = d.output;
  if (typeof out === "string") return out;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const item of out) {
      if (typeof item !== "object" || item === null) continue;
      const it = item as Record<string, unknown>;
      const content = it.content;
      if (typeof content === "string") parts.push(content);
      else if (Array.isArray(content)) {
        for (const p of content) {
          if (typeof p === "object" && p !== null) {
            const pp = p as Record<string, unknown>;
            if (typeof pp.text === "string") parts.push(pp.text);
            else if (typeof pp.output_text === "string") parts.push(pp.output_text);
          }
        }
      }
    }
    if (parts.length) return parts.join("");
  }
  return extractChatText(data);
}

function classify(status: number, step: string): string {
  if (status === 401 || status === 403) return "authentication error";
  if (status === 404) return `endpoint not found (${step})`;
  if (status === 429) return "rate limited";
  if (status >= 500) return `provider error HTTP ${status}`;
  return `provider HTTP ${status}`;
}

export async function callCodexDecider(req: DecisionRequest): Promise<AiProviderResult> {
  const apiKey = process.env.CODEX_API_KEY?.trim();
  const apiBase = process.env.CODEX_API_URL?.trim();
  const model = process.env.CODEX_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey || !apiBase) return { ok: false, error: "AI not configured" };

  const { chat, responses } = resolveEndpoints(apiBase);
  const userPrompt = buildDecisionPrompt(req);
  let lastError = "unknown error";

  const tryParse = (text: string): ValidatedModelDecision | null => {
    if (!text) return null;
    const parsed = parseJson(text);
    return parsed ? validateModelDecision(parsed) : null;
  };

  try {
    // ── 1) Chat Completions + JSON Schema structured output ──
    let r = await postJson(chat, apiKey, {
      model,
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_schema", json_schema: DECISION_JSON_SCHEMA },
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    if (r.status === 200) {
      const valid = tryParse(extractChatText(r.json));
      if (valid) return { ok: true, decision: valid, model };
      lastError = "invalid model response";
    } else if (r.status === 400) {
      // ── 1b) Retry without strict schema (gateways with json_object only) ──
      r = await postJson(chat, apiKey, {
        model,
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      if (r.status === 200) {
        const valid = tryParse(extractChatText(r.json));
        if (valid) return { ok: true, decision: valid, model };
        lastError = "invalid model response";
      } else {
        lastError = classify(r.status, "chat-completions");
      }
    } else {
      lastError = classify(r.status, "chat-completions");
    }

    // ── 2) Responses API (OpenAI-compatible) ──
    const rr = await postJson(responses, apiKey, {
      model,
      input: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      text: { format: { type: "json_schema", name: "energy_decision", strict: true, schema: DECISION_JSON_SCHEMA.schema } },
      max_output_tokens: 400,
    });
    if (rr.status === 200) {
      const valid = tryParse(extractResponsesText(rr.json));
      if (valid) return { ok: true, decision: valid, model };
      return { ok: false, model, error: "invalid model response" };
    }
    // If chat already gave a classified error, prefer it; else report responses error.
    if (lastError === "unknown error" || lastError.startsWith("endpoint not found")) {
      lastError = classify(rr.status, "responses");
    }
    console.error(`[ai-decider] failed model=${model} error=${lastError}`);
    return { ok: false, model, error: lastError };
  } catch (e) {
    return {
      ok: false,
      model,
      error: e instanceof Error && e.name === "AbortError" ? "timeout" : "network error",
    };
  }
}
