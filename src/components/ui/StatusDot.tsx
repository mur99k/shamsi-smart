export default function StatusDot({ tone }: { tone: "ai" | "local" | "pending" }) {
  const cls =
    tone === "ai"
      ? "bg-emerald-400/15 text-emerald-300"
      : tone === "local"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-white/10 text-slate-400";
  const label =
    tone === "ai"
      ? "● AI · Codex Everywhere"
      : tone === "local"
        ? "● Local Decision Engine"
        : "● …";
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>
  );
}
