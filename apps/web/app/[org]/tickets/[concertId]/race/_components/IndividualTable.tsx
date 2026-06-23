import type { RaceIndividual } from "@/lib/tickets-api";
import { RankBadge } from "./RankBadge";

function pct(rate: number) { return `${Math.round(rate * 100)}%`; }

export function IndividualTable({ individuals }: { individuals: RaceIndividual[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
        <span className="w-8 shrink-0">順位</span>
        <span className="flex-1">名前 / パート</span>
        <span className="w-20 text-right shrink-0">販売枚数</span>
        <span className="w-14 text-right shrink-0">情宣</span>
      </div>
      {individuals.map((m) => (
        <div
          key={m.memberId}
          className={[
            "flex items-center gap-2 px-4 py-3 border-b border-gray-100 last:border-0",
            m.rank <= 3 ? "bg-amber-50/40" : "hover:bg-gray-50",
          ].join(" ")}
        >
          <div className="w-8 flex justify-center shrink-0">
            <RankBadge rank={m.rank} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{m.nameJa}</p>
            <p className="text-xs text-gray-400">{m.partName ?? "—"}</p>
          </div>
          <div className="w-20 text-right shrink-0">
            <p className="text-sm font-semibold text-gray-800">{m.sold}枚</p>
            <p className="text-xs text-gray-400">{pct(m.rate)}</p>
          </div>
          <div className="w-14 text-right shrink-0">
            <p className="text-sm text-gray-600">{m.outreachCount}回</p>
          </div>
        </div>
      ))}
    </div>
  );
}
