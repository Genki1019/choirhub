import Link from "next/link";
import { CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { type ConcertSummary, type ConcertStatus } from "@/lib/concerts-api";

const STATUS_CONFIG: Record<ConcertStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "準備中", badge: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  survey_open: { label: "調査中", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  confirmed: { label: "確定済み", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  past: { label: "終了", badge: "bg-gray-100 text-gray-400", dot: "bg-gray-300" },
};

interface ConcertCardProps {
  concert: ConcertSummary;
  org: string;
}

export function ConcertCard({ concert, org }: ConcertCardProps) {
  const s = STATUS_CONFIG[concert.status];
  const date = new Date(concert.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const isPast = concert.status === "past";

  return (
    <Link
      href={`/${org}/concerts/${concert.id}`}
      prefetch={false}
      className={`hover:border-brand-300 block rounded-xl border border-gray-200 bg-white px-6 py-5 transition-all hover:shadow-sm ${isPast ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            {concert.surveyOpen && (
              <span className="text-xs font-medium text-amber-600">調査受付中</span>
            )}
          </div>
          <h2 className="font-semibold text-gray-800">{concert.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <CalendarDays size={13} className="text-gray-400" />
              {dateStr}
            </span>
            {concert.venue && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin size={13} className="text-gray-400" />
                {concert.venue}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-gray-400">{concert.stageCount}ステージ</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{concert.programCount}曲</span>
          </div>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-gray-400" />
      </div>
    </Link>
  );
}
