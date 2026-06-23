"use client";

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { type ScoreSummary } from "@/lib/scores-api";
import { ScoreRow } from "./ScoreRow";

interface UnassignedSectionProps {
  scores: ScoreSummary[];
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

export const UnassignedSection = memo(function UnassignedSection({
  scores, orgSlug, onMidiClick, onPurchaseClick, onFileManage, onCreateCollection,
  isPrivileged, isFileManager, canViewPrice, canSetPrice, onPriceUpdate,
}: UnassignedSectionProps) {
  const [open, setOpen] = useState(true);
  if (scores.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-gray-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <BookOpen size={15} className="text-gray-400 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold text-gray-500 text-sm">演奏会未定</span>
          <span className="text-xs text-gray-400 ml-2">{scores.length}曲</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {scores.map((score, idx) => (
            <div key={score.id} className={idx < scores.length - 1 ? "border-b border-gray-100" : ""}>
              <ScoreRow
                score={score} orgSlug={orgSlug} onMidiClick={onMidiClick}
                onPurchaseClick={onPurchaseClick} onFileManage={onFileManage}
                onCreateCollection={onCreateCollection}
                isPrivileged={isPrivileged} isFileManager={isFileManager}
                canViewPrice={canViewPrice} canSetPrice={canSetPrice} onPriceUpdate={onPriceUpdate}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
