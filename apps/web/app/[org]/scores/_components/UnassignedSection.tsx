"use client";

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { type ScoreSummary } from "@/lib/scores-api";
import { ScoreRow } from "./ScoreRow";

interface UnassignedSectionProps {
  scores: ScoreSummary[];
  orgSlug: string;
}

export const UnassignedSection = memo(function UnassignedSection({
  scores,
  orgSlug,
}: UnassignedSectionProps) {
  const [open, setOpen] = useState(true);
  if (scores.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-gray-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <BookOpen size={15} className="shrink-0 text-gray-400" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-500">演奏会未定</span>
          <span className="ml-2 text-xs text-gray-400">{scores.length}曲</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {scores.map((score, idx) => (
            <div
              key={score.id}
              className={idx < scores.length - 1 ? "border-b border-gray-100" : ""}
            >
              <ScoreRow score={score} orgSlug={orgSlug} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
