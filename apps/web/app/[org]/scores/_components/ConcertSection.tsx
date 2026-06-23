"use client";

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import { type ConcertWithScores, type ScoreSummary } from "@/lib/scores-api";
import { ScoreRow } from "./ScoreRow";

export const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:       { label: "準備中", color: "text-gray-400" },
  survey_open: { label: "調査中", color: "text-blue-500" },
  confirmed:   { label: "確定",   color: "text-green-600" },
  past:        { label: "終演",   color: "text-gray-400" },
};

interface ConcertSectionProps {
  concert: ConcertWithScores;
  orgSlug: string;
  onMidiClick: (s: ScoreSummary) => void;
  onPurchaseClick: (s: ScoreSummary) => void;
  onFileManage: (s: ScoreSummary) => void;
  onCreateCollection?: (s: ScoreSummary) => void;
  isPrivileged: boolean;
  isFileManager: boolean;
  canViewPrice: boolean;
  canSetPrice: boolean;
  onPriceUpdate: (id: string, price: number | null) => void;
}

export const ConcertSection = memo(function ConcertSection({
  concert, orgSlug, onMidiClick, onPurchaseClick, onFileManage, onCreateCollection,
  isPrivileged, isFileManager, canViewPrice, canSetPrice, onPriceUpdate,
}: ConcertSectionProps) {
  const [open, setOpen] = useState(true);

  const date = new Date(concert.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const status = STATUS_LABEL[concert.status] ?? { label: concert.status, color: "text-gray-400" };
  const totalPrograms = concert.stages.reduce((n, s) => n + s.programs.length, 0);

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-gray-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <CalendarDays size={15} className="text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{concert.title}</span>
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
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
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500">{stage.name}</p>
                  </div>
                )}
                {stage.programs.map((program, idx) => (
                  <div
                    key={program.id}
                    className={idx < stage.programs.length - 1 ? "border-b border-gray-100" : ""}
                  >
                    {program.score && (
                      <ScoreRow
                        score={program.score}
                        orgSlug={orgSlug}
                        onMidiClick={onMidiClick}
                        onPurchaseClick={onPurchaseClick}
                        onFileManage={onFileManage}
                        onCreateCollection={onCreateCollection}
                        isPrivileged={isPrivileged}
                        isFileManager={isFileManager}
                        canViewPrice={canViewPrice}
                        canSetPrice={canSetPrice}
                        onPriceUpdate={onPriceUpdate}
                      />
                    )}
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
