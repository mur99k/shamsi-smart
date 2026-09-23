"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Activity, Gauge, PlugZap, Sun, Cpu, BatteryCharging, ArrowLeft, ArrowRight, ArrowDown, Zap, Plug } from "lucide-react";
import { ACTION_META } from "@/types/energy";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function Home() {
  const { lang, sim, calc, decision, live } = useSolar();
  const ar = lang === "ar";
  const Forward = ar ? ArrowLeft : ArrowRight;
  const action = ACTION_META[decision.recommendedAction];
  const liveFresh = live !== null && live.ageMs < 20000;
  const showSolar = liveFresh ? Math.round(live.solarW) : calc.solarProductionW;
  const showLoad = liveFresh ? Math.round(live.consumptionW) : calc.consumptionW;
  const showBatt = liveFresh && live.batteryPct !== null ? `${Math.round(live.batteryPct)}%` : `${sim.batteryLevelPct}%`;

  const features = [
    { icon: Activity, cls: "feat-live", titleAr: "تحليل لحظي", titleEn: "Live analysis", descAr: "الحالة والقرار يتحدثان فور تغيير الإنتاج أو الاستهلاك.", descEn: "State and decision update the moment production or demand changes." },
    { icon: Gauge, cls: "feat-decision", titleAr: "قرار تلقائي مفسَّر", titleEn: "Explained decisions", descAr: "إجراء واحد مقترح مع سبب واضح، ومساعد يجيب عن أسئلتك.", descEn: "One suggested action with a clear reason, plus an assistant for questions." },
    { icon: PlugZap, cls: "feat-hardware", titleAr: "ربط مباشر مع أجهزة ESP32 والمستشعرات 🔌", titleEn: "Direct link with ESP32 devices & sensors 🔌", descAr: "نفس الحالة يمكن أن تأتي من حساسات حقيقية عبر USB لاحقًا.", descEn: "The same state can later come from real sensors over USB." },
  ];
  const steps = [
    { icon: Sun, num: "1", titleAr: "اقرأ", titleEn: "Read", descAr: "إنتاج الشمس واستهلاك المنزل لحظة بلحظة.", descEn: "Solar production and home demand, moment by moment." },
    { icon: Cpu, num: "2", titleAr: "حلّل", titleEn: "Analyze", descAr: "صافي الطاقة: فائض، توازن، أو عجز.", descEn: "Net state: surplus, balance, or shortage." },
    { icon: BatteryCharging, num: "3", titleAr: "وجّه", titleEn: "Route", descAr: "بطارية أو سيارة أو حمل إضافي.", descEn: "Battery, EV, or an additional load." },
  ];

  return <div className="landing-page">
    <section className="landing-hero-clean">
      <div className="landing-hero-copy">
        <span className="eyebrow">SOLARWISE · {ar ? "إدارة الطاقة الشمسية بذكاء" : "SMART SOLAR ENERGY MANAGEMENT"}</span>
        <h1>{ar ? "SolarWise — إدارة متكاملة لفائض الطاقة بالذكاء الاصطناعي" : "SolarWise — AI-powered solar surplus management"}</h1>
        <p>{ar ? "منصة ذكية تحلل قراءات الطاقة الشمسية لحظيًا، وتتخذ القرارات الآلية لتوجيه الفائض وإدارته بدقة." : "A smart platform that analyzes solar readings in real time and automates decisions to route and manage surplus precisely."}</p>
        <div className="landing-ctas">
          <Link className="button primary glow" href="/simulator">🚀 {ar ? "ابدأ المحاكاة التفاعلية" : "Start the interactive simulator"}</Link>
          <Link className="button bordered" href="/hardware">🔌 {ar ? "استكشف الأجهزة والمكونات" : "Explore devices & components"}</Link>
        </div>
        <span className="landing-note">{ar ? "نموذج برمجي للمحاكاة — لا توجد أجهزة متصلة حاليًا." : "Software simulation prototype — no hardware connected."} <Link className="text-link" href="/dashboard">{ar ? "عرض لوحة التحكم" : "View overview"}</Link></span>
      </div>
      <div className="landing-hero-visual">
        <div className="live-snapshot">
          <span className="live-pulse" aria-hidden="true"><Zap size={13} /></span>
          <h2>{ar ? "حالة النظام الآن" : "Live system state"}</h2>
          <p className={`live-source ${liveFresh ? "is-live" : ""}`} role="status">{liveFresh ? (ar ? "مباشر من ESP32 🟢" : "Live from ESP32 🟢") : (ar ? "محاكاة افتراضية" : "Simulated values")}</p>
          <dl className="live-rows">
            <div><dt><Sun size={15} aria-hidden="true" />{ar ? "الإنتاج" : "Solar"}</dt><dd dir="ltr" className="num">{showSolar} W</dd></div>
            <div><dt><Plug size={15} aria-hidden="true" />{ar ? "الاستهلاك" : "Load"}</dt><dd dir="ltr" className="num">{showLoad} W</dd></div>
            <div><dt><BatteryCharging size={15} aria-hidden="true" />{ar ? "البطارية" : "Battery"}</dt><dd dir="ltr" className="num">{showBatt}</dd></div>
          </dl>
          <p className="live-decision">{ar ? action.labelAr : action.labelEn}</p>
          <Link className="button primary" href="/simulator">{ar ? "افتح المحاكي" : "Open simulator"}</Link>
        </div>
      </div>
    </section>

    <section className="landing-features" aria-label={ar ? "مميزات النظام الذكي" : "Smart system features"}>
      <div className="landing-section-intro"><span className="eyebrow">{ar ? "مميزات النظام الذكي" : "SMART SYSTEM FEATURES"}</span><h2>{ar ? "لماذا SolarWise؟" : "Why SolarWise?"}</h2></div>
      <div className="feature-grid landing-feats">
        {features.map(f => <div key={f.titleEn} className={`feature-card ${f.cls}`}><span className="feature-icon"><f.icon size={22} aria-hidden="true" /></span><h3>{ar ? f.titleAr : f.titleEn}</h3><p>{ar ? f.descAr : f.descEn}</p></div>)}
      </div>
    </section>

    <section className="landing-how"><div className="landing-section-intro"><span className="eyebrow">{ar ? "الفكرة ببساطة" : "THE IDEA, SIMPLIFIED"}</span><h2>{ar ? "من القراءة إلى القرار." : "From reading to decision."}</h2><p>{ar ? "الإنتاج والاستهلاك يتغيران. النظام يحسب الحالة الحالية ثم يقترح ما يمكن فعله بالفائض." : "Production and demand change. The system calculates the current state, then recommends what can happen to the surplus."}</p></div>
      <div className="landing-steps big">
        {steps.map((s, i) => <Fragment key={s.num}>
          <div className="big-step">
            <span className="big-num" dir="ltr">{s.num}</span>
            <span className="big-icon"><s.icon size={26} /></span>
            <h3>{ar ? s.titleAr : s.titleEn}</h3><p>{ar ? s.descAr : s.descEn}</p>
          </div>
          {i < steps.length - 1 && <span className="big-link-h" aria-hidden="true"><Forward size={22} /></span>}
          {i < steps.length - 1 && <span className="big-link-v" aria-hidden="true"><ArrowDown size={22} /></span>}
        </Fragment>)}
      </div>
    </section>
  </div>;
}
