import { ArrowDown, ArrowLeft, ArrowRight, Sun, BatteryCharging, PlugZap, BrainCircuit, ToggleRight, LayoutDashboard, ShieldCheck, MessagesSquare, GitFork } from "lucide-react";
import type { Lang } from "./lang";

export default function ArchitectureViz({ lang }: { lang: Lang }) {
  const ar = lang === "ar";
  const Forward = ar ? ArrowLeft : ArrowRight;
  return <section className="arch-grid-section section"><h2>{ar ? "معمارية النظام" : "System architecture"}</h2>
    <p className="muted">{ar ? "ثلاث مراحل متصلة: قراءات حية، قرار ذكي، ثم تحكم بالأجهزة." : "Three connected stages: live readings, smart decision, then device control."}</p>

    <div className="arch-grid">
      <div className="arch-card inputs">
        <span className="arch-icon amber"><Sun size={22} /></span>
        <h3>{ar ? "المستشعرات والقراءات الحية" : "Sensors & live readings"}</h3>
        <ul>
          <li><Sun size={15} /> {ar ? "شمس: إنتاج الألواح لحظة بلحظة" : "Solar: panel output moment by moment"}</li>
          <li><BatteryCharging size={15} /> {ar ? "بطارية: مستوى الشحن والسعة" : "Battery: charge level and capacity"}</li>
          <li><PlugZap size={15} /> {ar ? "أحمال: استهلاك المنزل الحالي" : "Loads: current home consumption"}</li>
        </ul>
        <small className="muted">{ar ? "قراءات محاكاة حاليًا، والحساسات الحقيقية مخططة" : "Simulated readings for now, real sensors planned"}</small>
      </div>
      <span className="arch-arrow-h" aria-hidden="true"><Forward size={22} /></span>
      <span className="arch-arrow-v" aria-hidden="true"><ArrowDown size={22} /></span>

      <div className="arch-card engine">
        <span className="arch-icon violet"><BrainCircuit size={22} /></span>
        <h3>{ar ? "محرك الذكاء الاصطناعي لاتخاذ القرار" : "AI decision engine"}</h3>
        <ul>
          <li><GitFork size={15} /> {ar ? "خدمة القرار المنظم: أفضل وجهة للفائض" : "Decision service: best destination for surplus"}</li>
          <li><MessagesSquare size={15} /> {ar ? "خدمة المحادثة: شرح القرار والإجابة" : "Chat service: explaining decisions and answering"}</li>
        </ul>
        <small className="muted">{ar ? "قواعد محلية احتياطية عند تعذر الاتصال" : "Local backup rules when unreachable"}</small>
      </div>
      <span className="arch-arrow-h" aria-hidden="true"><Forward size={22} /></span>
      <span className="arch-arrow-v" aria-hidden="true"><ArrowDown size={22} /></span>

      <div className="arch-card outputs">
        <span className="arch-icon teal"><ToggleRight size={22} /></span>
        <h3>{ar ? "التحكم بالأجهزة والتنبيهات" : "Device control & alerts"}</h3>
        <ul>
          <li><ToggleRight size={15} /> {ar ? "الريليهات: تشغيل الأحمال والشواحن" : "Relays: switching loads and chargers"}</li>
          <li><LayoutDashboard size={15} /> {ar ? "اللمبات واللوحة: تنبيه المستخدم فورًا" : "Lights and dashboard: instant user alerts"}</li>
        </ul>
        <small className="muted">{ar ? "التحكم الفيزيائي مخطط — التوصيات استرشادية" : "Physical control is planned — recommendations are advisory"}</small>
      </div>
    </div>

    <p className="notice"><ShieldCheck size={15} /> {ar ? "مفاتيح الخدمة على الخادم فقط، ولا يتصل المتصفح بمزود الذكاء الاصطناعي مباشرة." : "Service keys stay on the server; the browser never contacts the AI provider directly."}</p>
  </section>;
}
