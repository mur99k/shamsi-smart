"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { calculateEnergy } from "@/lib/energy/calculations";
import { fallbackDecide } from "@/lib/ai/fallback";
import { buildDecisionRequest, DEFAULT_SIM_STATE, SCENARIOS, type SimState } from "@/lib/energy/scenarios";
import type { DecisionResponse, RecommendedAction } from "@/types/energy";
import type { Lang } from "./lang";

export interface Message {
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  snapshot: string;
  decision?: RecommendedAction;
  error?: boolean;
  /** True while tokens are still streaming in — render live, skip typewriter. */
  live?: boolean;
}

function useSolarState() {
  const [lang, setLang] = useState<Lang>("ar");
  const [sim, setSim] = useState<SimState>({ ...DEFAULT_SIM_STATE });
  const [scenarioId, setScenarioId] = useState("s1");
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [dataMode, setDataMode] = useState<"simulation" | "hardware">("simulation");
  const [serialStatus, setSerialStatus] = useState<"unsupported" | "disconnected" | "connecting" | "connected">("disconnected");
  const [live, setLive] = useState<{ solarW: number; consumptionW: number; batteryPct: number | null; ageMs: number } | null>(null);
  const revision = useRef(0);
  const decisionRequest = useRef<AbortController | null>(null);
  const chatRequest = useRef<AbortController | null>(null);
  const serialReader = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const serialAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => () => {
    decisionRequest.current?.abort();
    chatRequest.current?.abort();
    serialAbort.current?.abort();
    serialReader.current?.cancel().catch(() => undefined);
  }, []);
  // Poll the latest accepted ESP32 reading; the homepage shows it when fresh.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/telemetry");
        const data = await res.json();
        if (!alive || !res.ok) return;
        const l = data?.latest;
        if (l && typeof data?.ageMs === "number") {
          setLive({ solarW: l.solarProductionW, consumptionW: l.consumptionW, batteryPct: l.batteryLevelPercent ?? null, ageMs: data.ageMs });
        } else if (alive) {
          setLive(null);
        }
      } catch { /* telemetry unavailable — simulation values stay */ }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const calc = calculateEnergy(sim.solarProductionW, sim.consumptionW);
  const preview = fallbackDecide(buildDecisionRequest(sim));
  const decision = result?.decision ?? { ...preview, confidence: null };

  function patch(change: Partial<SimState>, scenario = "") {
    // Invalidate synchronously: a response already in flight cannot commit an old snapshot.
    revision.current += 1;
    decisionRequest.current?.abort();
    decisionRequest.current = null;
    setSim(previous => ({ ...previous, ...change }));
    setScenarioId(scenario);
    setResult(null);
    setLoading(false);
    setAnalysisError(false);
    if (dataMode === "hardware") setDataMode("simulation");
  }

  async function connectSerial() {
    const serial = (navigator as Navigator & { serial?: { requestPort: () => Promise<SerialPortLike> } }).serial;
    if (!serial) {
      setSerialStatus("unsupported");
      return;
    }
    serialAbort.current?.abort();
    setSerialStatus("connecting");
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: 115200 });
      const decoder = new TextDecoderStream();
      serialAbort.current = new AbortController();
      if (!port.readable) throw new Error("Serial port is not readable");
      port.readable.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>, { signal: serialAbort.current.signal }).catch(() => undefined);
      const reader = decoder.readable.getReader();
      serialReader.current = reader;
      setDataMode("hardware");
      setSerialStatus("connected");
      let buffer = "";
      while (!serialAbort.current.signal.aborted) {
        const next = await reader.read();
        if (next.done) break;
        buffer += next.value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const reading = JSON.parse(line) as { solarProductionW?: number; consumptionW?: number; batteryLevelPercent?: number };
            const change: Partial<SimState> = {};
            if (Number.isFinite(reading.solarProductionW)) change.solarProductionW = Math.max(0, Math.round(reading.solarProductionW!));
            if (Number.isFinite(reading.consumptionW)) change.consumptionW = Math.max(0, Math.round(reading.consumptionW!));
            if (Number.isFinite(reading.batteryLevelPercent)) change.batteryLevelPct = Math.min(100, Math.max(0, Math.round(reading.batteryLevelPercent!)));
            if (Object.keys(change).length) {
              setSim(previous => ({ ...previous, ...change }));
              setResult(null);
            }
          } catch { /* Ignore incomplete/non-JSON serial lines. */ }
        }
      }
      await reader.cancel();
      await port.close();
    } catch {
      setSerialStatus("disconnected");
      setDataMode("simulation");
    } finally {
      serialReader.current = null;
      if (serialStatus !== "unsupported") setSerialStatus("disconnected");
    }
  }

  function disconnectSerial() {
    serialAbort.current?.abort();
    serialReader.current?.cancel().catch(() => undefined);
    serialReader.current = null;
    setSerialStatus("disconnected");
    setDataMode("simulation");
  }

  function applyScenario(id: string) {
    const scenario = SCENARIOS.find(item => item.id === id);
    if (scenario) patch({ ...scenario.state, availableLoads: [...scenario.state.availableLoads] }, id);
  }

  async function analyze() {
    decisionRequest.current?.abort();
    const controller = new AbortController();
    decisionRequest.current = controller;
    const version = revision.current;
    setLoading(true);
    setAnalysisError(false);
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/api/ai/decision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDecisionRequest(sim)), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error("Decision unavailable");
      if (version === revision.current && decisionRequest.current === controller) setResult(data);
    } catch {
      if (version === revision.current && decisionRequest.current === controller) {
        setResult(null);
        setAnalysisError(true);
      }
    } finally {
      clearTimeout(timer);
      if (decisionRequest.current === controller) {
        decisionRequest.current = null;
        setLoading(false);
      }
    }
  }

  async function send(text: string) {
    const content = text.trim().slice(0, 1000);
    if (!content || chatRequest.current) return;
    // Reply in the language the user actually wrote (Arabic script → ar).
    const msgLang: Lang = /[؀-ۿ]/.test(content) ? "ar" : "en";
    const controller = new AbortController();
    chatRequest.current = controller;
    const state = buildDecisionRequest(sim);
    const snapshot = `${state.solarProductionW}W / ${state.consumptionW}W / ${state.battery.levelPercent}%`;
    const next: Message[] = [...messages, { role: "user" as const, content, snapshot, decision: decision.recommendedAction }].slice(-39);
    setMessages(next);
    setDraft("");
    setChatLoading(true);
    const timer = setTimeout(() => controller.abort(), 45000);
    // Empty assistant bubble appears instantly, then fills token by token.
    const base: Message[] = [...next, { role: "assistant" as const, content: "", snapshot, decision: decision.recommendedAction, live: true }].slice(-40);
    setMessages(base);
    const patchLive = (content: string, live: boolean, source?: "ai" | "fallback") =>
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.length - 1;
        const lastMsg = copy[idx];
        if (!lastMsg || lastMsg.role !== "assistant") return prev;
        copy[idx] = { ...lastMsg, content, live, ...(source ? { source } : {}) };
        return copy;
      });
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, signal: controller.signal,
        body: JSON.stringify({ state, decision: { recommendedAction: decision.recommendedAction, reason: decision.reason }, lang: msgLang,
          // API accepts at most 10 messages, each at most 1000 characters.
          messages: next.filter(message => !message.error).slice(-9).map(({ role, content: value }) => ({ role, content: value.slice(0, 1000) })),
        }),
      });
      if (!response.ok || !response.body) throw new Error("Chat unavailable");
      // Non-streaming JSON (tests, proxies): legacy contract path.
      if (!(response.headers.get("content-type") || "").includes("text/event-stream")) {
        const data = await response.json();
        if (!data?.success || typeof data.reply !== "string") throw new Error("Chat unavailable");
        setMessages([...next, { role: "assistant", content: data.reply, source: data.source === "ai" ? "ai" : "fallback", snapshot, decision: decision.recommendedAction }].slice(-40) as Message[]);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let settled = false;
      const finish = (content: string, source: "ai" | "fallback") => {
        if (settled) return;
        settled = true;
        patchLive(content, false, source);
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
            if (typeof evt.token === "string") {
              full += evt.token;
              patchLive(full, true, "ai");
            } else if (typeof evt.reply === "string") {
              finish(evt.reply, evt.source === "ai" ? "ai" : "fallback");
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
      if (!settled) {
        if (full.trim()) finish(full, "ai");
        else throw new Error("Chat unavailable");
      }
    } catch {
      setMessages([...next, { role: "assistant", content: msgLang === "ar" ? "لم يصلني رد. أعد إرسال سؤالك وسأجيبك فورًا." : "Could not get a reply. Send your question again to retry.", snapshot, error: true }].slice(-40) as Message[]);
    } finally {
      clearTimeout(timer);
      chatRequest.current = null;
      setChatLoading(false);
    }
  }

  return { lang, setLang, sim, calc, scenarioId, patch, applyScenario, result, decision, loading, analysisError, analyze,
    messages, draft, setDraft, chatLoading, send, clearChat: () => { if (!chatRequest.current) setMessages([]); },
    dataMode, serialStatus, connectSerial, disconnectSerial, live };
}

const SolarContext = createContext<ReturnType<typeof useSolarState> | null>(null);
export function SolarProvider({ children }: { children: React.ReactNode }) {
  const value = useSolarState();
  return <SolarContext.Provider value={value}>{children}</SolarContext.Provider>;
}
export function useSolar() {
  const value = useContext(SolarContext);
  if (!value) throw new Error("SolarProvider is required");
  return value;
}

interface SerialPortLike {
  readable?: ReadableStream<Uint8Array>;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}
