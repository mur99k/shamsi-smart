"use client";

import { ACTION_META } from "@/types/energy";
import { useSolar } from "./SolarProvider";

/** One-card live summary: current state plus the decision, nothing else. */
export default function ProductionReport() {
  const { calc, decision, result, lang } = useSolar();
  const ar = lang === "ar";
  const meta = ACTION_META[decision.recommendedAction];
  const statusAr = calc.status === "SURPLUS" ? "فائض" : calc.status === "SHORTAGE" ? "عجز" : "استقرار";
  const statusEn = calc.status === "SURPLUS" ? "surplus" : calc.status === "SHORTAGE" ? "shortage" : "balanced";
  return <section className="section production-report" aria-label={ar ? "تقرير الإنتاج" : "Production report"}>
    <div className="report-summary">
      <span className="report-status">{ar ? "حالة الطاقة الآن" : "Current energy state"}: <strong>{ar ? statusAr : statusEn}</strong></span>
      <strong className="report-decision-name">{ar ? meta.labelAr : meta.labelEn}</strong>
      <span className="badge">{result ? result.source === "ai" ? (ar ? "ذكاء اصطناعي" : "AI response") : (ar ? "استجابة احتياطية" : "Server fallback") : (ar ? "معاينة محلية" : "Local preview")}</span>
    </div>
    <p className="small muted">{ar ? "ملخص القيم الحالية فقط. لا توجد قياسات حقيقية أو وفورات مثبتة." : "Current values only. No real measurements or proven savings."}</p>
  </section>;
}
