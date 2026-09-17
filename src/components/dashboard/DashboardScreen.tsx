"use client";

import Link from "next/link";
import { SlidersHorizontal, Pause, Play } from "lucide-react";
import { useState } from "react";
import { useSolar } from "./SolarProvider";
import EnergyOverview from "./EnergyOverview";
import EnergyFlow from "./EnergyFlow";
import AIRecommendation from "./AIRecommendation";

export default function DashboardScreen() {
  const { lang, sim, calc, decision } = useSolar();
  const [motion, setMotion] = useState(true);
  const ar = lang === "ar";
  return <div className="solar-experience">
    <section className="experience-intro"><h1>{ar ? "طاقتك، في صورة واحدة." : "Your energy, in perspective."}</h1><div><p>{ar ? "اقرأ الحالة الحالية ووجهة الطاقة المقترحة. عدّل المدخلات في المحاكي، وستظهر نتائجها هنا." : "Read the current state and suggested energy destination. Edit inputs in the simulator and see their results here."}</p><Link className="text-link" href="/simulator"><SlidersHorizontal size={17} />{ar ? "تعديل في المحاكي" : "Edit in simulator"}</Link></div></section>
    <section className={`energy-studio ${motion ? "" : "motion-paused"}`} aria-label={ar ? "حالة الطاقة الحالية" : "Current energy state"}>
      <div className="studio-toolbar"><span className="simulation-label">{ar ? "حالة محاكاة للقراءة" : "Simulation snapshot"}</span><button className="motion-button" onClick={() => setMotion(!motion)} aria-pressed={!motion}>{motion ? <Pause size={14} /> : <Play size={14} />}{motion ? (ar ? "إيقاف الحركة" : "Pause motion") : (ar ? "تشغيل الحركة" : "Resume motion")}</button></div>
      <EnergyOverview calc={calc} batteryLevelPct={sim.batteryLevelPct} lang={lang} />
      <EnergyFlow calc={calc} batteryLevelPct={sim.batteryLevelPct} batteryCapacityWh={sim.batteryCapacityWh} active={decision.recommendedAction} lang={lang} />
    </section>
    <dl className="overview-device-state"><div><dt>{ar ? "البطارية" : "Battery"}</dt><dd>{sim.batteryAvailable ? (ar ? "متاحة" : "Available") : (ar ? "غير متاحة" : "Unavailable")} · {sim.batteryCapacityWh} Wh · {sim.batteryLevelPct}%</dd></div><div><dt>{ar ? "السيارة الكهربائية" : "EV"}</dt><dd>{!sim.evAvailable ? (ar ? "غير متاحة" : "Unavailable") : sim.evCharging ? (ar ? "قيد الشحن افتراضياً" : "Simulated charging") : (ar ? "متاحة وليست قيد الشحن" : "Available, not charging")}</dd></div></dl>
    <div className="experience-insights"><AIRecommendation /><section className="understand-energy"><h2>{ar ? "قرار يمكنك فهمه." : "A decision you can understand."}</h2><p>{ar ? "المعاينة محلية. اطلب تحليلاً أو ناقش تفاصيل القرار مع المساعد." : "The preview uses local rules. Request an analysis or discuss the decision with the assistant."}</p><Link href="/assistant" className="button primary">{ar ? "ناقش حالتك مع المساعد" : "Discuss this with the assistant"}</Link><details className="explanation"><summary>{ar ? "كيف تُحسب هذه الأرقام؟" : "How are these numbers calculated?"}</summary><p>{ar ? "الصافي هو الإنتاج ناقص الاستهلاك. الموجب فائض، والسالب عجز، والصفر توازن دون إجراء. أولوية الفائض: بطارية متاحة بسعة موجبة ومستوى أقل من 80%، ثم سيارة غير مشغولة، ثم أحمال متاحة، وإلا تقليل الإنتاج. لا تُحاكى معدلات الشحن." : "Net power is generation minus consumption. Positive means surplus, negative means shortage, and zero means balance with no action. Surplus priority: an available battery with positive capacity below 80%, then an idle EV, then available loads, otherwise curtailment. Charging rates are not simulated."}</p></details></section></div>
  </div>;
}
