"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Trash2, LoaderCircle, Sparkles, Square } from "lucide-react";
import { ACTION_META } from "@/types/energy";
import { useSolar } from "./SolarProvider";

export default function AIChat() {
  const { lang, messages, draft, setDraft, chatLoading, send, clearChat } = useSolar();
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const ar = lang === "ar";
  // Typewriter reveal for the newest assistant reply: masks thinking latency.
  const [typed, setTyped] = useState<Record<number, number>>({});
  useEffect(() => {
    const i = messages.length - 1;
    const m = messages[i];
    if (!m || m.role !== "assistant" || m.error) return;
    const full = m.content.length;
    if ((typed[i] ?? 0) >= full) return;
    const id = window.setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setTyped(t => (t[i] === full ? t : { ...t, [i]: full }));
      } else {
        setTyped(t => ({ ...t, [i]: Math.min(full, (t[i] ?? 0) + 28) }));
      }
    }, 35);
    return () => window.clearTimeout(id);
  }, [messages, typed]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages, chatLoading]);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);
  const questions = ar ? ["هل عندي فائض الآن؟", "لماذا هذا القرار؟", "ماذا لو امتلأت البطارية؟"] : ["Do I have surplus now?", "Why this decision?", "What if the battery fills up?"];
  return <section className="chat-workspace" aria-label={ar ? "المحادثة" : "Conversation"}>
    <div className="section-heading"><h2>{ar ? "المحادثة" : "Conversation"}</h2><button className="icon-button" onClick={() => { setTyped({}); clearChat(); }} disabled={chatLoading || !messages.length} aria-label={ar ? "مسح المحادثة" : "Clear conversation"} title={ar ? "مسح المحادثة" : "Clear conversation"}><Trash2 size={18} /></button></div>
    <div ref={box} className="chat-history" role="log" aria-live="polite" aria-relevant="additions" aria-busy={chatLoading}>
      {!messages.length && <div className="chat-empty"><h3>{ar ? "ما سؤالك عن حالة الطاقة؟" : "What would you like to know?"}</h3><p>{ar ? "الإنتاج والاستهلاك وحالة البطارية جاهزة للنقاش." : "Solar output, consumption and battery state are ready to discuss."}</p></div>}
      {messages.map((message, index) => {
        const shown = message.role === "assistant" && !message.error ? (typed[index] ?? message.content.length) : message.content.length;
        const typing = message.role === "assistant" && !message.error && shown < message.content.length;
        return <article key={index} className={`message ${message.role}`}><div className="message-meta"><strong>{message.role === "user" ? (ar ? "أنت" : "You") : message.error ? (ar ? "تعذر الرد" : "No reply") : (ar ? "المساعد" : "Assistant")}</strong></div><div className="bubble" dir={message.role === "user" ? (/[\u0600-\u06FF]/.test(message.content) ? "rtl" : "ltr") : undefined}>{message.role === "assistant" && !message.error && <Sparkles size={15} className="bubble-icon" aria-hidden="true" />}<p dir="auto" className={message.error ? "error-text" : ""}>{message.content.slice(0, shown)}{typing ? "▍" : ""}</p></div>{message.role === "assistant" && !message.error && message.decision && <div className="bubble-badges"><span className="badge">{ar ? ACTION_META[message.decision].labelAr : ACTION_META[message.decision].labelEn}</span></div>}</article>; })}
      {chatLoading && <div className="chat-loading" role="status"><LoaderCircle className="spin" size={18} /><span className="typing" aria-hidden="true"><span /><span /><span /></span>{ar ? "جارٍ إعداد الرد على الحالة المرسلة..." : "Preparing a reply for the submitted state..."}</div>}
    </div>
    <div className="chat-dock">
    <div className="quick-questions">{questions.map(question => <button key={question} disabled={chatLoading} onClick={() => send(question)}>{question}</button>)}</div>
    <form className="chat-compose" onSubmit={event => { event.preventDefault(); void send(draft); }}><textarea ref={field} aria-label={ar ? "سؤالك" : "Your question"} placeholder={ar ? "اسأل عن حالة الطاقة..." : "Ask about the energy state..."} maxLength={1000} rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); } }} /><button className="icon-button primary send-button" type="submit" disabled={chatLoading || !draft.trim()} title={ar ? "إرسال" : "Send"} aria-label={ar ? "إرسال" : "Send"}>{chatLoading ? <Square size={16} /> : <Send size={20} />}</button></form>
    </div>
    <p className="small muted">{ar ? "الإجابات تخص الحالة المرفقة بكل رسالة. المحادثة محفوظة أثناء التنقل فقط." : "Replies refer to each message's attached state. Conversation is retained during navigation only."}</p>
  </section>;
}
