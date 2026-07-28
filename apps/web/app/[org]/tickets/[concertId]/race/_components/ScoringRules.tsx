import { SCORING_CRITERIA } from "@/lib/scoring-criteria";
import type { RaceScoringConfig } from "@/lib/tickets-api";

export function ScoringRules({ scoring }: { scoring: RaceScoringConfig }) {
  const rules = SCORING_CRITERIA.filter((c) => scoring[c.key].enabled).map((c) => ({
    label: scoring[c.key].label,
    pts: scoring[c.key].points,
  }));
  return (
    <details className="bg-brand-50 border-brand-100 text-brand-700 rounded-xl border px-4 py-3 text-xs">
      <summary className="cursor-pointer font-semibold select-none">ポイントルール</summary>
      <div className="mt-2 space-y-1">
        {rules.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-36 shrink-0">{r.label}</span>
            <span className="text-brand-500 font-mono">{r.pts.join(", ")}pt</span>
          </div>
        ))}
        <p className="text-brand-400 mt-2">
          速さは「N枚売った人が3名達成」の日時が早いパート順。同率タイは平均ポイント。
        </p>
      </div>
    </details>
  );
}
