import { ACTION_META, RECOMMENDED_ACTIONS, type RecommendedAction } from "@/types/energy";
import type { Lang } from "./lang";

export default function AvailableActions({
  active,
  lang,
}: {
  active: RecommendedAction;
  lang: Lang;
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-[14px] font-bold text-white">
        🎯 {lang === "ar" ? "الإجراءات المتاحة" : "Available Actions"}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {RECOMMENDED_ACTIONS.map((a) => {
          const isActive = active === a;
          return (
            <div
              key={a}
              className={`rounded-xl border px-3 py-2.5 transition ${isActive ? "border-amber-300/60 bg-amber-400/10" : "border-white/10 bg-white/[.02]"}`}
            >
              <div className="text-lg" aria-hidden>{ACTION_META[a].icon}</div>
              <div className="mt-0.5 text-[12px] font-semibold text-slate-100">
                {lang === "ar" ? ACTION_META[a].labelAr : ACTION_META[a].labelEn}
              </div>
              {isActive && (
                <div className="text-[10.5px] font-bold text-amber-300">
                  ★ {lang === "ar" ? "مُوصى به" : "Recommended"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
