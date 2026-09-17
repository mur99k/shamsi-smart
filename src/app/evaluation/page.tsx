"use client";

import EvaluationRunner from "@/components/dashboard/EvaluationRunner";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function EvaluationPage() {
  const { lang } = useSolar();
  return <><div className="page-heading"><div><h1>{lang === "ar" ? "تقييم القرارات" : "Decision Evaluation"}</h1><p>{lang === "ar" ? "خمس حالات ثابتة، نتائج مقاسة لكل تشغيل." : "Five fixed cases. Measured results for each run."}</p></div></div><EvaluationRunner lang={lang} /></>;
}
