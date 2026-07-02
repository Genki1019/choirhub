import type { RaceScoringConfig } from "@/lib/tickets-api";

export function ScoringRules({ scoring }: { scoring: RaceScoringConfig }) {
  const rules = [
    { label: scoring.avgSales.label,  pts: scoring.avgSales.points },
    { label: scoring.speed5.label,    pts: scoring.speed5.points },
    { label: scoring.speed10.label,   pts: scoring.speed10.points },
    { label: scoring.zeroRatio.label, pts: scoring.zeroRatio.points },
    { label: scoring.outreach.label,  pts: scoring.outreach.points },
  ];
  return (
    <details className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-xs text-brand-700">
      <summary className="font-semibold cursor-pointer select-none">ポイントルール</summary>
      <div className="mt-2 space-y-1">
        {rules.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-36 shrink-0">{r.label}</span>
            <span className="text-brand-500 font-mono">{r.pts.join(", ")}pt</span>
          </div>
        ))}
        <p className="mt-2 text-brand-400">
          速さは「N枚売った人が3名達成」の日時が早いパート順。同率タイは平均ポイント。
        </p>
      </div>
    </details>
  );
}
