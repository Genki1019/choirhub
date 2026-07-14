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
      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50"
    >
      <BookOpen size={15} className="shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{score.title}</p>
        <CreatorLine composer={score.composer} arranger={score.arranger} />
      </div>
      <ChevronRight size={14} className="shrink-0 text-gray-300" />
    </Link>
  );
}
