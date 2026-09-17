"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { calculateEnergy } from "@/lib/energy/calculations";
import { fallbackDecide } from "@/lib/ai/fallback";
import { buildDecisionRequest, DEFAULT_SIM_STATE, SCENARIOS, type SimState } from "@/lib/energy/scenarios";
import type { DecisionResponse } from "@/types/energy";
import type { Lang } from "./lang";

export interface Message {
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  snapshot: string;
  error?: boolean;
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
    const controller = new AbortController();
    chatRequest.current = controller;
    const state = buildDecisionRequest(sim);
    const snapshot = `${state.solarProductionW}W / ${state.consumptionW}W / ${state.battery.levelPercent}%`;
    const next: Message[] = [...messages, { role: "user" as const, content, snapshot }].slice(-39);
    setMessages(next);
    setDraft("");
    setChatLoading(true);
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ state, decision: { recommendedAction: decision.recommendedAction, reason: decision.reason }, lang,
          // API accepts at most 10 messages, each at most 1000 characters.
          messages: next.filter(message => !message.error).slice(-9).map(({ role, content: value }) => ({ role, content: value.slice(0, 1000) })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success || typeof data.reply !== "string") throw new Error("Chat unavailable");
      setMessages([...next, { role: "assistant", content: data.reply, source: data.source === "ai" ? "ai" : "fallback", snapshot }].slice(-40) as Message[]);
    } catch {
      setMessages([...next, { role: "assistant", content: lang === "ar" ? "تعذر الحصول على رد. أعد إرسال سؤالك للمحاولة مجدداً." : "Could not get a reply. Send your question again to retry.", snapshot, error: true }].slice(-40) as Message[]);
    } finally {
      clearTimeout(timer);
      chatRequest.current = null;
      setChatLoading(false);
    }
  }

  return { lang, setLang, sim, calc, scenarioId, patch, applyScenario, result, decision, loading, analysisError, analyze,
    messages, draft, setDraft, chatLoading, send, clearChat: () => { if (!chatRequest.current) setMessages([]); },
    dataMode, serialStatus, connectSerial, disconnectSerial };
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
