"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Plus, Loader2, AlertCircle, BookOpen } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scoresApi, type GroupedScores, type ScoreSummary } from "@/lib/scores-api";
import { scoresKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { ScoreFormModal } from "./_components/ScoreFormModal";
import { ConcertSection } from "./_components/ConcertSection";
import { UnassignedSection } from "./_components/UnassignedSection";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function ScoresPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();

  const { roles } = useMember();
  const [showAddModal, setShowAddModal] = useState(false);

  const {
    data,
    isLoading: loading,
    error: scoresError,
  } = useQuery({
    queryKey: scoresKeys.grouped(org),
    queryFn: () => scoresApi.grouped(org),
  });

  const existingScores = useMemo(
    () => [
      ...(data?.unassigned ?? []),
      ...(data?.concerts.flatMap((c) =>
        c.stages.flatMap((s) => s.programs.flatMap((p) => (p.score ? [p.score] : []))),
      ) ?? []),
    ],
    [data],
  );

  const handleScoreCreated = (score: ScoreSummary, stageAssigned: boolean) => {
    if (stageAssigned) {
      queryClient.invalidateQueries({ queryKey: scoresKeys.grouped(org) });
    } else {
      queryClient.setQueryData<GroupedScores>(scoresKeys.grouped(org), (prev) =>
        prev ? { ...prev, unassigned: [...prev.unassigned, score] } : prev,
      );
    }
    setShowAddModal(false);
  };

  const totalScores = data
    ? data.concerts.reduce((n, c) => n + c.stages.reduce((m, s) => m + s.programs.length, 0), 0) +
      data.unassigned.length
    : 0;

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800">楽譜</h1>
            {!loading && data && <span className="text-sm text-gray-400">{totalScores}曲</span>}
          </div>
          {roles.includes("admin") && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              <Plus size={14} />
              曲目を追加
            </button>
          )}
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && scoresError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
            <AlertCircle size={16} />
            <span className="text-sm">{scoresError.message}</span>
          </div>
        )}

        {!loading && data && (
          <>
            {data.concerts.length === 0 && data.unassigned.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">楽譜が登録されていません</p>
              </div>
            )}

            {data.concerts.map((concert) => (
              <ConcertSection key={concert.id} concert={concert} orgSlug={org} />
            ))}

            <UnassignedSection scores={data.unassigned} orgSlug={org} />
          </>
        )}
      </PageMain>

      {showAddModal && (
        <ScoreFormModal
          mode="add"
          orgSlug={org}
          existingScores={existingScores}
          concerts={data?.concerts ?? []}
          onClose={() => setShowAddModal(false)}
          onCreated={handleScoreCreated}
        />
      )}
    </div>
  );
}
