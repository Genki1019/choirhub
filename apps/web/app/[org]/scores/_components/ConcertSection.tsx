"use client";

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import { type ConcertWithScores } from "@/lib/scores-api";
import { ScoreRow } from "./ScoreRow";

interface ConcertSectionProps {
  concert: ConcertWithScores;
  orgSlug: string;
}

export const ConcertSection = memo(function ConcertSection({
  concert,
  orgSlug,
}: ConcertSectionProps) {
  const [open, setOpen] = useState(true);

  const date = new Date(concert.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const totalPrograms = concert.stages.reduce((n, s) => n + s.programs.length, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-gray-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <CalendarDays size={15} className="text-brand-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-800">{concert.title}</span>
          <p className="mt-0.5 text-xs text-gray-400">
            {dateStr}
            {concert.venue && ` ・ ${concert.venue}`}
            {` ・ ${totalPrograms}曲`}
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {totalPrograms === 0 ? (
            <p className="px-5 py-4 text-xs text-gray-400">曲目が登録されていません</p>
          ) : (
            concert.stages.map((stage) => (
              <div key={stage.id}>
                {concert.stages.length > 1 && (
                  <div className="border-b border-gray-100 bg-gray-50 px-5 py-2">
                    <p className="text-xs font-semibold text-gray-500">{stage.name}</p>
                  </div>
                )}
                {stage.programs.map((program, idx) => (
                  <div
                    key={program.id}
                    className={idx < stage.programs.length - 1 ? "border-b border-gray-100" : ""}
                  >
                    {program.score && <ScoreRow score={program.score} orgSlug={orgSlug} />}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
});
