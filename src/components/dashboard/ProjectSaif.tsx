import Link from "next/link";
import { TriangleAlert, Lightbulb, TrendingUp, FlaskConical, Cable, Cpu, Rocket } from "lucide-react";
import type { Lang } from "./lang";

const TECH = ["Next.js", "React", "TypeScript", "Tailwind CSS", "Playwright", "Open-Meteo"];

export default function ProjectSaif({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  const steps = [
    { icon: FlaskConical, titleAr: "محاكاة برمجية", titleEn: "Software simulation", descAr: "تعمل الآن — مدخلات افتراضية وقرارات استرشادية", descEn: "Live now — simulated inputs, advisory decisions", stateAr: "نشط", stateEn: "Active", done: true },
    { icon: Cable, titleAr: "واجهة القياس", titleEn: "Telemetry API", descAr: "‎/api/telemetry جاهزة لاستقبال قراءات حقيقية", descEn: "/api/telemetry ready for real readings", stateAr: "جاهز", stateEn: "Ready", done: true },
    { icon: Cpu, titleAr: "ربط ESP32", titleEn: "ESP32 link", descAr: "إرسال القياسات الحية من العتاد إلى النموذج", descEn: "Streaming live measurements from hardware", stateAr: "مخطط", stateEn: "Planned", done: false },
    { icon: Rocket, titleAr: "تشغيل ميداني تجريبي", titleEn: "Field pilot", descAr: "اختبار ميداني مع عدّادات Wh واختبارات أمان", descEn: "Field test with Wh metering and safety checks", stateAr: "مستقبل", stateEn: "Future", done: false },
  ];
  return <article className="project-showcase">
    <div className="feature-cards">
      <section className="feature-card warm">
        <span className="feature-icon"><TriangleAlert size={22} /></span>
        <h2>{ar ? "المشكلة" : "The problem"}</h2>
        <p>{ar ? "يتغير إنتاج الطاقة الشمسية والاستهلاك المنزلي باستمرار. ينشأ فائض في بعض الفترات وعجز في فترات أخرى، وقد تحتاج الأنظمة الصغيرة إلى قرارات يدوية لتوجيه الفائض." : "Solar production and household demand both vary. This creates periods of surplus and shortage, and small installations may require manual decisions about excess energy."}</p>
      </section>
      <section className="feature-card smart">
        <span className="feature-icon"><Lightbulb size={22} /></span>
        <h2>{ar ? "الحل الذكي" : "The smart solution"}</h2>
        <p>{ar ? "نموذج مساعد يجمع حسابات طاقة حتمية، توصية منظمة من الذكاء الاصطناعي، ومحادثة مبنية على نفس حالة النظام. عند تعذر خدمة الذكاء الاصطناعي تتوفر قواعد قرار محلية." : "An assistant prototype combining deterministic energy calculations, structured AI recommendations and a conversation grounded in the same system state. Local decision rules remain available when the AI service fails."}</p>
      </section>
      <section className="feature-card impact">
        <span className="feature-icon"><TrendingUp size={22} /></span>
        <h2>{ar ? "الأثر والجدوى" : "Impact & feasibility"}</h2>
        <p>{ar ? "توجيه الفائض للبطارية والأحمال المرنة قد يقلل الهدر ويطيل عمر التخزين — جدوى متوقعة تتطلب قياس Wh ميدانيًا ومقارنة بخط أساس قبل اعتماد أي وفورات." : "Routing surplus to batteries and flexible loads may cut waste and extend storage life — an expected benefit that requires field Wh metering against a baseline before claiming any savings."}</p>
      </section>
    </div>

    <section className="scope-strip">
      <div><h2>{ar ? "نطاق النموذج" : "Prototype scope"}</h2><p>{ar ? "المدخلات افتراضية. التوصيات استرشادية ولا تشغل عتاداً." : "Inputs are simulated. Recommendations are advisory and do not operate hardware."}</p></div>
      <Link href="/evaluation" className="button primary">{ar ? "فتح التقييم" : "Open evaluation"}</Link>
    </section>

    <section className="tech-panel">
      <h2>{ar ? "التقنيات المستخدمة" : "Tech stack"}</h2>
      <ul className="tech-badges">{TECH.map(t => <li key={t} dir="ltr">{t}</li>)}</ul>
      <p className="small muted">{ar ? "عقود API مشتركة للقرار والمحادثة." : "Shared API contracts for decisions and chat."}</p>
    </section>

    <section className="hw-timeline-panel">
      <div className="hw-timeline-head"><h2>{ar ? "مراحل التكامل مع الأجهزة الحقيقية" : "Real-hardware integration stages"}</h2><Link href="/hardware" className="button">{ar ? "خطة العتاد" : "Hardware plan"}</Link></div>
      <ol className="hw-timeline">
        {steps.map(s => <li key={s.titleEn} className={s.done ? "hw-step done" : "hw-step"}>
          <span className="hw-dot"><s.icon size={18} /></span>
          <div><strong>{ar ? s.titleAr : s.titleEn}</strong><p>{ar ? s.descAr : s.descEn}</p></div>
          <span className="hw-state">{ar ? s.stateAr : s.stateEn}</span>
        </li>)}
      </ol>
    </section>
  </article>;
}
