"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Battery, Cpu, Sun } from "lucide-react";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function Home() {
  const { lang } = useSolar();
  const ar = lang === "ar";
  return <div className="landing-page">
    <section className="landing-hero-clean">
      <div className="landing-hero-copy">
        <span className="eyebrow">{ar ? "إدارة الطاقة الشمسية بذكاء" : "SMART SOLAR ENERGY MANAGEMENT"}</span>
        <h1>{ar ? "استفد من كل واط." : "Make every watt count."}</h1>
        <p>{ar ? "نظام يساعدك على فهم فائض الطاقة الشمسية وتوجيهه إلى الوجهة الأنسب — من خلال المحاكاة وقرار ذكي قابل للشرح." : "A decision system that helps you understand solar surplus and route it to the most suitable destination through simulation and explainable intelligence."}</p>
        <div className="landing-ctas"><Link className="button primary" href="/simulator">{ar ? "تجربة المحاكي" : "Try the simulator"}<ArrowUpRight size={17} /></Link><Link className="button" href="/dashboard">{ar ? "عرض لوحة التحكم" : "View overview"}<ArrowRight size={17} /></Link></div>
        <span className="landing-note">{ar ? "نموذج برمجي للمحاكاة — لا توجد أجهزة متصلة حاليًا." : "Software simulation prototype — no hardware connected."}</span>
      </div>
      <div className="landing-hero-media"><Image src="/solar-panels.jpg" alt={ar ? "ألواح شمسية في ضوء النهار" : "Solar panels in daylight"} fill priority sizes="(max-width: 700px) 100vw, 48vw" /></div>
    </section>

    <section className="landing-how"><div className="landing-section-intro"><span className="eyebrow">{ar ? "الفكرة ببساطة" : "THE IDEA, SIMPLIFIED"}</span><h2>{ar ? "من القراءة إلى القرار." : "From reading to decision."}</h2><p>{ar ? "الإنتاج والاستهلاك يتغيران. النظام يحسب الحالة الحالية ثم يقترح ما يمكن فعله بالفائض." : "Production and demand change. The system calculates the current state, then recommends what can happen to the surplus."}</p></div><div className="landing-steps"><div><span>01</span><Sun size={22} /><h3>{ar ? "اقرأ" : "Read"}</h3><p>{ar ? "إنتاج الشمس واستهلاك المنزل." : "Solar production and home demand."}</p></div><div><span>02</span><Cpu size={22} /><h3>{ar ? "حلل" : "Analyze"}</h3><p>{ar ? "صافي الطاقة: فائض، توازن، أو عجز." : "Net state: surplus, balance, or shortage."}</p></div><div><span>03</span><Battery size={22} /><h3>{ar ? "وجّه" : "Route"}</h3><p>{ar ? "بطارية أو سيارة أو حمل إضافي." : "Battery, EV, or an additional load."}</p></div></div></section>
  </div>;
}
