"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Plus, BookOpen } from "lucide-react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scoresApi, type GroupedScores, type ScoreSummary } from "@/lib/scores-api";
import { scoresKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { ScoreFormModal } from "./_components/ScoreFormModal";
import { ConcertSection } from "./_components/ConcertSection";
import { UnassignedSection } from "./_components/UnassignedSection";
import { PageWithHeader } from "@/components/PageWithHeader";

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
    <>
      <PageWithHeader
        title="楽譜"
        badge={data ? <span className="text-sm text-gray-400">{totalScores}曲</span> : undefined}
        loading={loading}
        mainClassName="space-y-4"
        actions={
          roles.includes("admin") ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              <Plus size={14} />
              曲目を追加
            </button>
          ) : undefined
        }
      >
        <ErrorMessage variant="section">
          {scoresError &&
            userErrorMessage(
              scoresError,
              "楽譜の読み込みに失敗しました。ページを再読み込みしてください。",
            )}
        </ErrorMessage>

        {data && (
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
      </PageWithHeader>

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
    </>
  );
}
