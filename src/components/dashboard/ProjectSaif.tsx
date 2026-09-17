import Link from "next/link";
import type { Lang } from "./lang";

export default function ProjectSaif({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  return <article className="case-study">
    <section><h2>{ar ? "المشكلة" : "The problem"}</h2><p>{ar ? "يتغير إنتاج الطاقة الشمسية والاستهلاك المنزلي باستمرار. ينشأ فائض في بعض الفترات وعجز في فترات أخرى، وقد تحتاج الأنظمة الصغيرة إلى قرارات يدوية لتوجيه الفائض." : "Solar production and household demand both vary. This creates periods of surplus and shortage, and small installations may require manual decisions about excess energy."}</p></section>
    <section><h2>{ar ? "الحل المقترح" : "The proposed solution"}</h2><p>{ar ? "نموذج مساعد يجمع حسابات طاقة حتمية، توصية منظمة من الذكاء الاصطناعي، ومحادثة مبنية على نفس حالة النظام. عند تعذر خدمة الذكاء الاصطناعي تتوفر قواعد قرار محلية." : "An assistant prototype combining deterministic energy calculations, structured AI recommendations and a conversation grounded in the same system state. Local decision rules remain available when the AI service fails."}</p></section>
    <section><h2>{ar ? "نطاق النموذج" : "Prototype scope"}</h2><p>{ar ? "المدخلات افتراضية. التوصيات استرشادية ولا تشغل عتاداً. التقييم يقيس نتائج خمس حالات وزمن الاستجابة، ولا يثبت كفاءة طاقة أو وفراً مالياً." : "Inputs are simulated. Recommendations are advisory and do not operate hardware. Evaluation measures five case outcomes and response times, not energy efficiency or financial savings."}</p><Link href="/evaluation">{ar ? "فتح التقييم" : "Open evaluation"}</Link></section>
    <section><h2>{ar ? "التقنية والخطوة التالية" : "Technology and next steps"}</h2><p>Next.js · React · TypeScript · Tailwind CSS</p><p>{ar ? "عقود API مشتركة للقرار والمحادثة. تكامل الحساسات وESP32 وRaspberry Pi مخطط للمستقبل ويتطلب طبقة تكامل واختبارات أمان." : "Shared API contracts for decisions and chat. Sensors, ESP32 and Raspberry Pi are future work requiring integration and safety testing."}</p><Link href="/hardware">{ar ? "خطة العتاد" : "Hardware roadmap"}</Link></section>
  </article>;
}
