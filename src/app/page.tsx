"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Activity, Battery, Cpu, Sun, Cable, Gauge } from "lucide-react";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function Home() {
  const { lang } = useSolar();
  const ar = lang === "ar";
  return <div className="landing-page">
    <section className="landing-hero-clean">
      <div className="landing-hero-copy">
        <Image src="/logo-solarwise.png" alt="SolarWise — Intelligent Solar Energy Management" width={300} height={294} className="hero-logo" priority />
        <span className="eyebrow">{ar ? "إدارة الطاقة الشمسية بذكاء" : "SMART SOLAR ENERGY MANAGEMENT"}</span>
        <h1>{ar ? "استفد من كل واط." : "Make every watt count."}</h1>
        <p>{ar ? "نظام يساعدك على فهم فائض الطاقة الشمسية وتوجيهه إلى الوجهة الأنسب — من خلال المحاكاة وقرار ذكي قابل للشرح." : "A decision system that helps you understand solar surplus and route it to the most suitable destination through simulation and explainable intelligence."}</p>
        <div className="landing-ctas"><Link className="button primary" href="/simulator">{ar ? "تجربة المحاكي" : "Try the simulator"}<ArrowUpRight size={17} /></Link><Link className="button" href="/dashboard">{ar ? "عرض لوحة التحكم" : "View overview"}<ArrowRight size={17} /></Link></div>
        <span className="landing-note">{ar ? "نموذج برمجي للمحاكاة — لا توجد أجهزة متصلة حاليًا." : "Software simulation prototype — no hardware connected."}</span>
      </div>
      <div className="landing-hero-media"><Image src="/solar-panels.jpg" alt={ar ? "ألواح شمسية في ضوء النهار" : "Solar panels in daylight"} fill priority sizes="(max-width: 700px) 100vw, 48vw" /></div>
    </section>

    <section className="landing-features" aria-label={ar ? "مميزات النظام الذكي" : "Smart system features"}>
      <div className="landing-section-intro"><span className="eyebrow">{ar ? "مميزات النظام الذكي" : "SMART SYSTEM FEATURES"}</span><h2>{ar ? "لماذا SolarWise؟" : "Why SolarWise?"}</h2></div>
      <div className="feature-grid">
        <div className="feature-card"><span className="feature-icon"><Activity size={20} aria-hidden="true" /></span><h3>{ar ? "تحليل لحظي" : "Live analysis"}</h3><p>{ar ? "الحالة والقرار يتحدثان فور تغيير الإنتاج أو الاستهلاك." : "State and decision update the moment production or demand changes."}</p></div>
        <div className="feature-card"><span className="feature-icon"><Gauge size={20} aria-hidden="true" /></span><h3>{ar ? "قرار تلقائي مفسَّر" : "Explained decisions"}</h3><p>{ar ? "إجراء واحد مقترح مع سبب واضح، ومساعد يجيب عن أسئلتك." : "One suggested action with a clear reason, plus an assistant for questions."}</p></div>
        <div className="feature-card"><span className="feature-icon"><Cable size={20} aria-hidden="true" /></span><h3>{ar ? "جاهز لعتاد ESP32" : "ESP32-ready"}</h3><p>{ar ? "نفس الحالة يمكن أن تأتي من حساسات حقيقية عبر USB لاحقًا." : "The same state can later come from real sensors over USB."}</p></div>
      </div>
    </section>

    <section className="landing-how"><div className="landing-section-intro"><span className="eyebrow">{ar ? "الفكرة ببساطة" : "THE IDEA, SIMPLIFIED"}</span><h2>{ar ? "من القراءة إلى القرار." : "From reading to decision."}</h2><p>{ar ? "الإنتاج والاستهلاك يتغيران. النظام يحسب الحالة الحالية ثم يقترح ما يمكن فعله بالفائض." : "Production and demand change. The system calculates the current state, then recommends what can happen to the surplus."}</p></div><div className="landing-steps"><div><span>01</span><Sun size={22} /><h3>{ar ? "اقرأ" : "Read"}</h3><p>{ar ? "إنتاج الشمس واستهلاك المنزل." : "Solar production and home demand."}</p></div><div><span>02</span><Cpu size={22} /><h3>{ar ? "حلل" : "Analyze"}</h3><p>{ar ? "صافي الطاقة: فائض، توازن، أو عجز." : "Net state: surplus, balance, or shortage."}</p></div><div><span>03</span><Battery size={22} /><h3>{ar ? "وجّه" : "Route"}</h3><p>{ar ? "بطارية أو سيارة أو حمل إضافي." : "Battery, EV, or an additional load."}</p></div></div></section>
  </div>;
}
