"use client";

import { useEffect, useRef } from "react";
import { Send, Trash2, LoaderCircle } from "lucide-react";
import { useSolar } from "./SolarProvider";

export default function AIChat() {
  const { lang, messages, draft, setDraft, chatLoading, send, clearChat } = useSolar();
  const box = useRef<HTMLDivElement>(null);
  const ar = lang === "ar";
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages, chatLoading]);
  const questions = ar ? ["هل عندي فائض الآن؟", "لماذا هذا القرار؟", "ماذا لو امتلأت البطارية؟"] : ["Do I have surplus now?", "Why this decision?", "What if the battery fills up?"];
  return <section className="chat-workspace" aria-label={ar ? "المحادثة" : "Conversation"}>
    <div className="section-heading"><h2>{ar ? "المحادثة" : "Conversation"}</h2><button className="icon-button" onClick={clearChat} disabled={chatLoading || !messages.length} aria-label={ar ? "مسح المحادثة" : "Clear conversation"} title={ar ? "مسح المحادثة" : "Clear conversation"}><Trash2 size={18} /></button></div>
    <div ref={box} className="chat-history" role="log" aria-live="polite" aria-relevant="additions" aria-busy={chatLoading}>
      {!messages.length && <div className="chat-empty"><h3>{ar ? "ما سؤالك عن حالة الطاقة؟" : "What would you like to know?"}</h3><p>{ar ? "الإنتاج والاستهلاك وحالة البطارية جاهزة للنقاش." : "Solar output, consumption and battery state are ready to discuss."}</p></div>}
      {messages.map((message, index) => <article key={index} className={`message ${message.role}`}><div className="message-meta"><strong>{message.role === "user" ? (ar ? "أنت" : "You") : message.error ? (ar ? "خطأ اتصال" : "Request error") : message.source === "ai" ? (ar ? "المساعد · AI" : "Assistant · AI") : (ar ? "المساعد · محلي" : "Assistant · Local")}</strong><span dir="ltr" title={ar ? "الإنتاج / الاستهلاك / البطارية" : "Production / consumption / battery"}>{message.snapshot}</span></div><p dir="auto" className={message.error ? "error-text" : ""}>{message.content}</p></article>)}
      {chatLoading && <div className="chat-loading" role="status"><LoaderCircle className="spin" size={18} />{ar ? "جارٍ إعداد الرد على الحالة المرسلة..." : "Preparing a reply for the submitted state..."}</div>}
    </div>
    <div className="quick-questions">{questions.map(question => <button key={question} disabled={chatLoading} onClick={() => send(question)}>{question}</button>)}</div>
    <form className="chat-compose" onSubmit={event => { event.preventDefault(); void send(draft); }}><textarea aria-label={ar ? "سؤالك" : "Your question"} placeholder={ar ? "اسأل عن حالة الطاقة..." : "Ask about the energy state..."} maxLength={1000} rows={3} value={draft} onChange={event => setDraft(event.target.value)} /><button className="icon-button primary" type="submit" disabled={chatLoading || !draft.trim()} title={ar ? "إرسال" : "Send"} aria-label={ar ? "إرسال" : "Send"}><Send size={20} /></button></form>
    <p className="small muted">{ar ? "الإجابات تخص الحالة المرفقة بكل رسالة. المحادثة محفوظة أثناء التنقل فقط." : "Replies refer to each message's attached state. Conversation is retained during navigation only."}</p>
  </section>;
}
