"use client";

import { useState } from "react";
import { Siren, Droplets, Cable, Wrench, CircleHelp, Clapperboard } from "lucide-react";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function AlertsPage() {
  const { lang } = useSolar();
  const ar = lang === "ar";
  const [sprinkle, setSprinkle] = useState(false);
  const [tech, setTech] = useState(false);

  return <>
    <div className="page-heading"><div><h1>{ar ? "نظام التشخيص والتنبيهات الذكية" : "Smart Fault Diagnostics & Alerts"}</h1><p>{ar ? "طبلون تحكم مبسط — هل النظام يعمل بكفاءة؟ وأين المشكلة؟" : "A simple dashboard — is the system healthy, and where is the fault?"}</p></div><span className="badge">🔋 SolarWise</span></div>

    <div className="alert-alexa"><span aria-hidden="true">🎙️</span>{ar ? "جاهز للربط الصوتي مستقبلًا مع Alexa — «أليكسا، كيف حالة الطاقة الشمسية؟»" : "Voice-ready for future Alexa link — “Alexa, how is my solar doing?”"}</div>

    <div className="alert-grid">
      <article className="alert-card ok">
        <h2>{ar ? "اللوح رقم 1" : "Panel 1"} <span className="alert-tag ok" dir="ltr">98W · {ar ? "ممتاز" : "Excellent"}</span></h2>
        <p>{ar ? "يعمل بالطاقة الإنتاجية الكاملة دون ظلال." : "Running at full output with no shading."}</p>
      </article>
      <article className="alert-card error">
        <h2>{ar ? "اللوح رقم 2" : "Panel 2"} <span className="alert-tag warn" dir="ltr">22W · {ar ? "انخفاض" : "Low"}</span></h2>
        <p>{ar ? "تنبيه: أداء منخفض جدًا يتطلب التدخل." : "Alert: very low output, action needed."}</p>
      </article>
    </div>

    <section className="alert-diagnostic">
      <h2><Siren size={20} aria-hidden="true" />{ar ? "تم اكتشاف انخفاض كفاءة في [اللوح رقم 2]" : "Efficiency drop detected in [Panel 2]"}</h2>
      <p className="muted">{ar ? "المتوقع" : "Expected"}: <b dir="ltr">100W</b> · {ar ? "الفعلي" : "Actual"}: <b dir="ltr">22W</b></p>
      <ol>
        <li><b>{ar ? "تنظيف اللوح:" : "Clean the panel:"}</b> {ar ? "مسح الغبار عن اللوح رقم 2." : "Wipe dust off panel 2."} <button className="button" onClick={() => { setSprinkle(true); setTech(false); }}><Droplets size={15} />{ar ? "تشغيل رشاش الماء الآلي" : "Run auto sprinklers"}</button></li>
        <li><b>{ar ? "فحص الأسلاك:" : "Check wiring:"}</b> {ar ? "التأكد من ثبات الكابل الخلفي للوح رقم 2." : "Make sure panel 2 rear cable is firm."} <span className="small muted"><Cable size={13} /> {ar ? "فحص يدوي سريع" : "Quick manual check"}</span></li>
        <li><b>{ar ? "الدعم الفني:" : "Technician:"}</b> {ar ? "إذا استمر الانخفاض، أرسل التقرير للشركة." : "If it persists, send the report to the vendor."}</li>
      </ol>
      {sprinkle && <p role="status" className="alert-status">{ar ? "جاري تشغيل رشاش الماء الآلي لتنظيف اللوح رقم 2..." : "Running auto sprinklers for panel 2..."}</p>}
      <button className="button primary" onClick={() => { setTech(true); setSprinkle(false); }}><Wrench size={16} />{ar ? "طلب فني صيانة معتمد للوح رقم 2" : "Request a certified technician for panel 2"}</button>
      {tech && <p role="status" className="alert-status">{ar ? "تم إرسال التقرير والتشخيص للفني المعتمد." : "Report sent to the certified technician."}</p>}
    </section>

    <section className="alert-video"><Clapperboard size={22} aria-hidden="true" /><h2>{ar ? "شاهد الفيديو التوضيحي (1:30 دقيقة)" : "Watch the explainer video (1:30)"}</h2><p>{ar ? "خطوة بخطوة: كيف يستجيب النظام وينبه العميل." : "Step by step: how the system responds and alerts you."}</p></section>

    <section className="alert-faq">
      <h2><CircleHelp size={19} aria-hidden="true" />{ar ? "الأسئلة الشائعة" : "Frequently asked questions"}</h2>
      <details><summary>{ar ? "لماذا تستغرق البطارية 3 أيام للشحن رغم وجود لوحين؟" : "Why does the battery take 3 days to charge with two panels?"}</summary><p>{ar ? "قد يكون أحد الألواح متسخًا. يحدد النظام اللوح المعطوب فورًا بدل استدعاء فني للكشف على الكل." : "One panel may be dirty. The system pinpoints the faulty panel instead of a costly full inspection."}</p></details>
      <details><summary>{ar ? "هل يعمل من الجوال واللابتوب بالعربي والإنجليزي؟" : "Does it work on mobile and laptop in Arabic and English?"}</summary><p>{ar ? "نعم، متجاوب بالكامل مع دعم اللغتين." : "Yes, fully responsive with both languages."}</p></details>
      <details><summary>{ar ? "كيف يعمل الربط مع Alexa؟" : "How does the Alexa link work?"}</summary><p>{ar ? "معمارية جاهزة للربط المستقبلي عبر Alexa Skills API للاستعلام والتنبيه صوتيًا." : "Architecture ready for future Alexa Skills API voice queries and alerts."}</p></details>
    </section>
  </>;
}
