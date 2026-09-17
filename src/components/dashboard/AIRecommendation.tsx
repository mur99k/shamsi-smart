"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { ACTION_META } from "@/types/energy";
import { useSolar } from "./SolarProvider";

export default function AIRecommendation() {
  const { result, decision, lang, loading, analysisError, analyze, calc } = useSolar();
  const ar = lang === "ar";
  const meta = ACTION_META[decision.recommendedAction];
  const localReasons = {
    battery_storage: `يتوفر فائض ${calc.excessEnergyW}W. تعطي القاعدة المحلية أولوية لشحن البطارية المتاحة بسعة موجبة عندما يكون مستواها أقل من 80%.`,
    ev_charging: `يتوفر فائض ${calc.excessEnergyW}W. بعد شرط أولوية البطارية، تقترح القاعدة شحن السيارة المتاحة التي ليست قيد الشحن.`,
    additional_load: `يتوفر فائض ${calc.excessEnergyW}W. تقترح القاعدة توجيهه للأحمال المتاحة بعد شروط البطارية والسيارة.`,
    reduce_solar_input: "يتوفر فائض دون بطارية مؤهلة أو سيارة غير مشغولة أو حمل إضافي متاح. التوصية هي تقليل الإنتاج الشمسي؛ لا يرسل النموذج أمراً إلى أجهزة فعلية.",
    no_action: "لا يُقترح إجراء إضافي. عند التوازن يتساوى الإنتاج والاستهلاك، فلا يوجد فائض أو عجز.",
    energy_shortage: `يتجاوز الاستهلاك الإنتاج بمقدار ${calc.energyShortageW}W. لا يوجد فائض لإعادة التوجيه؛ يُقترح تقليل الأحمال غير الأساسية.`,
  };
  return <section className="section recommendation" aria-busy={loading}>
    <div className="section-heading"><h2>{ar ? "التوصية الحالية" : "Current recommendation"}</h2><span className="badge">{result ? result.source === "ai" ? (ar ? "ذكاء اصطناعي" : "AI response") : (ar ? "استجابة احتياطية" : "Server fallback") : (ar ? "معاينة محلية" : "Local preview")}</span></div>
    <h3>{ar ? meta.labelAr : meta.labelEn}</h3>
    <p className="reason" dir="auto">{ar && !result ? localReasons[decision.recommendedAction] : decision.reason}</p>
    {result?.decision.confidence != null && <p className="muted">{ar ? "ثقة النموذج، وليست دقة مقاسة" : "Model confidence, not measured accuracy"}: {Math.round(result.decision.confidence * 100)}%</p>}
    <div role="status">{analysisError && <p className="error-text">{ar ? "تعذر التحليل. المعاينة المحلية متاحة؛ حاول مجدداً." : "Analysis unavailable. Local preview remains available; try again."}</p>}</div>
    <button className="button" disabled={loading} onClick={analyze}>{loading ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}{loading ? (ar ? "جارٍ التحليل..." : "Analyzing...") : (ar ? "تحليل الحالة" : "Analyze state")}</button>
    <p className="muted small">{ar ? "توصية استرشادية فقط. لا يتم تشغيل أجهزة فعلية." : "Advisory only. No physical devices are operated."}</p>
  </section>;
}
