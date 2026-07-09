"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { type ScoreSummary } from "@/lib/scores-api";
import { CreatorLine } from "./CreatorLine";

interface ScoreRowProps {
  score: ScoreSummary;
  orgSlug: string;
}

export function ScoreRow({ score, orgSlug }: ScoreRowProps) {
  return (
    <Link
      href={`/${orgSlug}/scores/${score.id}`}
      prefetch={false}
      className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
    >
      <BookOpen size={15} className="text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{score.title}</p>
        <CreatorLine composer={score.composer} arranger={score.arranger} />
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </Link>
  );
}
