import { ArrowDown } from "lucide-react";
import type { Lang } from "./lang";

export default function ArchitectureViz({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  return <section className="architecture section"><h2>{ar ? "معمارية النظام الحالية" : "Current system architecture"}</h2>
    <ol className="architecture-path"><li>{ar ? "المحاكاة: SimState" : "Simulation: SimState"}</li><li><ArrowDown aria-hidden="true" />calculateEnergy / buildDecisionRequest</li><li><ArrowDown aria-hidden="true" />{ar ? "حالة مشتركة عبر الصفحات" : "Shared state across routes"}</li></ol>
    <div className="architecture-branches"><div><h3>{ar ? "القرار المنظم" : "Structured decision"}</h3><code>POST /api/ai/decision</code><p>{ar ? "تحقق من المدخلات، حساب الطاقة، مزود AI، تحقق من النتيجة، أو محرك احتياطي." : "Input validation, energy calculation, AI provider, output validation or local fallback."}</p></div><div><h3>{ar ? "المحادثة" : "Conversation"}</h3><code>POST /api/ai/chat</code><p>{ar ? "الحالة الحالية والقرار وسجل محدود للمحادثة، ثم رد مبني على هذه البيانات." : "Current state, decision and bounded conversation history, followed by a grounded reply."}</p></div></div>
    <p className="notice">{ar ? "مفاتيح المزود على الخادم فقط. لا اتصال مباشر بين المتصفح ومزود الذكاء الاصطناعي." : "Provider credentials stay server-side. The browser never calls the AI provider directly."}</p>
  </section>;
}
