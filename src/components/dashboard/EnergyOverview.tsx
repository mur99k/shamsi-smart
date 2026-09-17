import type { EnergyCalc } from "@/lib/energy/types";
import type { Lang } from "./lang";

export default function EnergyOverview({ calc, batteryLevelPct, lang }: { calc: EnergyCalc; batteryLevelPct: number; lang: Lang }) {
  const ar = lang === "ar";
  const metrics = [
    [ar ? "الإنتاج الشمسي" : "Solar production", `${calc.solarProductionW}`, "W"],
    [ar ? "الاستهلاك" : "Consumption", `${calc.consumptionW}`, "W"],
    [ar ? "صافي الطاقة" : "Net power", `${calc.netEnergyW > 0 ? "+" : ""}${calc.netEnergyW}`, "W"],
    [ar ? "مستوى البطارية" : "Battery level", `${batteryLevelPct}`, "%"],
  ];
  return <dl className="metrics">{metrics.map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd className="num" dir="ltr">{value}<span>{unit}</span></dd></div>)}</dl>;
}
