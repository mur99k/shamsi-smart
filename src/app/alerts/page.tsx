"use client";

import { useState } from "react";
import { Droplets, SearchCheck, Wrench, CircleHelp, Smartphone, Laptop, Monitor } from "lucide-react";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function AlertsPage() {
  const { lang } = useSolar();
  const ar = lang === "ar";
  const [autoWash, setAutoWash] = useState(false);
  const [washed, setWashed] = useState(false);
  const [tech, setTech] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const runWash = () => {
    setWashed(true); setTech(false);
    setToast(ar ? "بدأ رش الماء على اللوح رقم 2 — عاد للإنتاج الكامل." : "Sprinklers started on panel 2 — back to full output.");
    window.setTimeout(() => setToast(null), 3500);
  };
  const callTech = () => {
    setTech(true);
    setToast(ar ? "تم إرسال التقرير للفني المعتمد." : "Report sent to the certified technician.");
    window.setTimeout(() => setToast(null), 3500);
  };

  return <>
    {toast && <div role="status" className="alert-toast">{toast}</div>}
    <div className="page-heading"><div><h1>{ar ? "نظام التشخيص والتنبيهات الذكية" : "Smart Fault Diagnostics & Alerts"}</h1><p>{ar ? "مراقبة فورية وتأكيد سلامة الألواح الشمسية" : "Real-time monitoring and solar panel safety assurance"}</p></div><span className="badge">🔋 SolarWise</span></div>

    <div className="alert-alexa"><span aria-hidden="true">🎙️</span>{ar ? "جاهز للربط الصوتي مستقبلًا مع Alexa" : "Voice-ready for future Alexa link"}</div>

    <article className={`alert-card fault ${washed ? "ok" : "error"}`}>
      <h2>⚠️ {ar ? "تنبيه: اللوح رقم 2 فيه انخفاض أداء (غبار/وساخة)" : "Alert: Panel 2 underperforming (dust/dirt)"}</h2>
      <p>{ar ? "المتوقع" : "Expected"}: <b dir="ltr">100W</b> · {ar ? "الفعلي" : "Actual"}: <b dir="ltr">{washed ? "98W" : "22W"}</b>{washed && (ar ? " — تم الإصلاح بالغسيل ✨" : " — fixed by washing ✨")}</p>
    </article>

    <div className="alert-actions">
      <button className="button primary big" onClick={runWash}><Droplets size={22} aria-hidden="true" /><span>{ar ? "تشغيل الرشاش الآلي" : "Run auto sprinklers"}</span></button>
      <button className="button big" aria-expanded={inspect} onClick={() => setInspect(v => !v)}><SearchCheck size={22} aria-hidden="true" /><span>{ar ? "طريقة فحص الأسلاك" : "How to inspect wiring"}</span></button>
      <button className="button big" onClick={callTech}><Wrench size={22} aria-hidden="true" /><span>{ar ? "طلب صيانة" : "Request maintenance"}</span></button>
    </div>
    {inspect && <p role="status" className="alert-inspect">{ar ? "افتح الغطاء الخلفي للوح رقم 2 وتأكد أن الكابل مشبوك بإحكام ولا توجد أسلاك مكشوفة." : "Open panel 2 rear cover and make sure its cable is firmly connected with no exposed wires."}</p>}
    {tech && <p role="status" className="alert-status">{ar ? "تم إرسال التقرير والتشخيص للفني المعتمد." : "Report sent to the certified technician."}</p>}

    <div className="alert-wash-row">
      <button role="switch" aria-checked={autoWash} onClick={() => setAutoWash(v => !v)} className={`wash-switch ${autoWash ? "on" : ""}`}><span className="wash-knob" aria-hidden="true" /></button>
      <span>{ar ? "تفعيل الغسيل الآلي عند تراكم الغبار وتراجع الأداء" : "Enable auto-wash when dust builds up and output drops"}</span>
    </div>

    <p className="alert-saving">💰 {ar ? "وفّرت هذا الشهر 300 ريال صيانة بالتشخيص الذاتي." : "Saved SAR 300 in maintenance this month with self-diagnosis."} <small className="muted">{ar ? "مثال توضيحي." : "Illustrative example."}</small></p>

    <section className="alert-devices">
      <div><Smartphone size={20} aria-hidden="true" /><strong>{ar ? "الجوال" : "Mobile"}</strong><small>{ar ? "تنبيهات فورية بالعربي" : "Instant Arabic alerts"}</small></div>
      <div><Laptop size={20} aria-hidden="true" /><strong>{ar ? "اللابتوب" : "Laptop"}</strong><small>{ar ? "لوحة التشخيص الكاملة" : "Full diagnostics board"}</small></div>
      <div><Monitor size={20} aria-hidden="true" /><strong>{ar ? "الكمبيوتر" : "Desktop"}</strong><small>{ar ? "متابعة المحطة الكبيرة" : "Large-station view"}</small></div>
    </section>

    <section className="alert-faq">
      <h2><CircleHelp size={19} aria-hidden="true" />{ar ? "الأسئلة الشائعة" : "Frequently asked questions"}</h2>
      <details><summary>{ar ? "لماذا تستغرق البطارية 3 أيام للشحن رغم وجود لوحين؟" : "Why does the battery take 3 days to charge with two panels?"}</summary><p>{ar ? "قد يكون أحد الألواح متسخًا. يحدد النظام اللوح المعطوب فورًا بدل استدعاء فني للكشف على الكل." : "One panel may be dirty. The system pinpoints the faulty panel instead of a costly full inspection."}</p></details>
      <details><summary>{ar ? "هل يعمل من الجوال واللابتوب بالعربي والإنجليزي؟" : "Does it work on mobile and laptop in Arabic and English?"}</summary><p>{ar ? "نعم، متجاوب بالكامل مع دعم اللغتين." : "Yes, fully responsive with both languages."}</p></details>
      <details><summary>{ar ? "كيف يعمل الربط مع Alexa؟" : "How does the Alexa link work?"}</summary><p>{ar ? "معمارية جاهزة للربط المستقبلي عبر Alexa Skills API للاستعلام والتنبيه صوتيًا." : "Architecture ready for future Alexa Skills API voice queries and alerts."}</p></details>
    </section>
  </>;
}
