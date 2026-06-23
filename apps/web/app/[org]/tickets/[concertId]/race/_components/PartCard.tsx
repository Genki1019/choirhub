import type { RacePart, RaceScoringConfig } from "@/lib/tickets-api";
import { RankBadge } from "./RankBadge";

function fmt(n: number, digits = 1) { return n.toFixed(digits); }
function pct(rate: number) { return `${Math.round(rate * 100)}%`; }

function BreakdownChip({ label, points, max }: { label: string; points: number; max: number }) {
  if (points === 0) {
    return <span className="text-xs text-gray-300 line-through">{label}</span>;
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-blue-600">{points}</span>
      <span className="text-gray-300">/{max}</span>
    </span>
  );
}

export function PartCard({ part, scoring }: { part: RacePart; scoring: RaceScoringConfig }) {
  const bd = part.breakdown;
  const st = part.stats;
  const maxPoints =
    (scoring.avgSales.points[0] ?? 0) +
    (scoring.speed5.points[0] ?? 0) +
    (scoring.speed10.points[0] ?? 0) +
    (scoring.zeroRatio.points[0] ?? 0) +
    (scoring.outreach.points[0] ?? 0);

  return (
    <div
      className={[
        "rounded-xl border px-5 py-4 transition-colors",
        part.rank === 1 ? "bg-amber-50 border-amber-300" :
        part.rank === 2 ? "bg-gray-50 border-gray-300" :
        part.rank === 3 ? "bg-orange-50 border-orange-200" :
        "bg-white border-gray-100",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5 shrink-0">
          <RankBadge rank={part.rank} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-gray-800">{part.partName}</p>
            <p className="text-xl font-bold text-gray-800 shrink-0">
              {part.totalPoints}<span className="text-sm font-normal text-gray-400">/{maxPoints}pt</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <BreakdownChip label="平均販売" points={bd.avgSalesPoints}   max={scoring.avgSales.points[0] ?? 0} />
            <BreakdownChip label="速5枚"   points={bd.speed5Points}     max={scoring.speed5.points[0] ?? 0} />
            <BreakdownChip label="速10枚"  points={bd.speed10Points}    max={scoring.speed10.points[0] ?? 0} />
            <BreakdownChip label="ゼロ率"  points={bd.zeroRatioPoints}  max={scoring.zeroRatio.points[0] ?? 0} />
            <BreakdownChip label="情宣"    points={bd.outreachPoints}   max={scoring.outreach.points[0] ?? 0} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span>平均{fmt(st.avgSold)}枚</span>
            <span>{st.sold}/{st.allocated}枚 ({pct(st.allocated > 0 ? st.sold / st.allocated : 0)})</span>
            <span>情宣{st.totalOutreach}回</span>
            <span>0枚{Math.round(st.zeroSellerRatio * 100)}%</span>
          </div>
          {(st.speed5AchievedAt || st.speed10AchievedAt) && (
            <div className="flex gap-3 mt-1 text-xs text-gray-400">
              {st.speed5AchievedAt && (
                <span>5枚×3名: {new Date(st.speed5AchievedAt).toLocaleDateString("ja-JP")}</span>
              )}
              {st.speed10AchievedAt && (
                <span>10枚×3名: {new Date(st.speed10AchievedAt).toLocaleDateString("ja-JP")}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
