import { ArrowDown, Sun, BatteryCharging, PlugZap, BrainCircuit, ToggleRight, LayoutDashboard, ShieldCheck } from "lucide-react";
import type { Lang } from "./lang";

export default function ArchitectureViz({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  return <section className="arch-flow section"><h2>{ar ? "معمارية النظام" : "System architecture"}</h2>
    <p className="muted">{ar ? "تدفق البيانات من المدخلات إلى القرار ثم إلى التحكم — كل مرحلة معلنة وقابلة للاختبار." : "Data flows from inputs to decision to control — every stage declared and testable."}</p>

    <div className="glass-node inputs">
      <h3>{ar ? "المستشعرات والمدخلات" : "Sensors & inputs"}</h3>
      <ul>
        <li><Sun size={16} /> {ar ? "حساس الإنتاج الشمسي" : "Solar sensor"}</li>
        <li><BatteryCharging size={16} /> {ar ? "حساس البطارية" : "Battery sensor"}</li>
        <li><PlugZap size={16} /> {ar ? "حساس الأحمال" : "Load sensors"}</li>
      </ul>
      <code dir="ltr">SimState · calculateEnergy</code>
    </div>
    <span className="flow-arrow" aria-hidden="true"><ArrowDown size={20} /></span>

    <div className="glass-node engine">
      <h3><BrainCircuit size={18} /> {ar ? "محرك القرار والذكاء الاصطناعي" : "AI decision engine"}</h3>
      <p>{ar ? "تحقق من المدخلات، حساب الطاقة، مزود AI، تحقق من النتيجة — أو محرك احتياطي محلي." : "Input validation, energy calculation, AI provider, output validation — or a local fallback engine."}</p>
      <div className="arch-branches-glass">
        <div><h4>{ar ? "القرار المنظم" : "Structured decision"}</h4><code dir="ltr">POST /api/ai/decision</code></div>
        <div><h4>{ar ? "المحادثة" : "Conversation"}</h4><code dir="ltr">POST /api/ai/chat</code></div>
      </div>
    </div>
    <span className="flow-arrow" aria-hidden="true"><ArrowDown size={20} /></span>

    <div className="glass-node outputs">
      <h3>{ar ? "الأوامر والتحكم" : "Commands & control"}</h3>
      <ul>
        <li><ToggleRight size={16} /> {ar ? "المرحلات الفيزيائية (مخطط)" : "Physical relays (planned)"}</li>
        <li><LayoutDashboard size={16} /> {ar ? "تحديثات لوحة العرض" : "Dashboard updates"}</li>
      </ul>
    </div>

    <p className="notice glass-notice"><ShieldCheck size={15} /> {ar ? "مفاتيح المزود على الخادم فقط. لا اتصال مباشر بين المتصفح ومزود الذكاء الاصطناعي." : "Provider credentials stay server-side. The browser never calls the AI provider directly."}</p>
  </section>;
}
