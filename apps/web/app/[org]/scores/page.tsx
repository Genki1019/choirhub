"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, BookOpen } from "lucide-react";
import { scoresApi, type ConcertWithScores, type ScoreSummary } from "@/lib/scores-api";
import { ApiClientError } from "@/lib/api-client";
import { useMember } from "@/contexts/MemberContext";
import { ScoreFormModal } from "./_components/ScoreFormModal";
import { ConcertSection } from "./_components/ConcertSection";
import { UnassignedSection } from "./_components/UnassignedSection";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function ScoresPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();

  const { roles } = useMember();
  const [data, setData] = useState<{ concerts: ConcertWithScores[]; unassigned: ScoreSummary[] } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loading = loadedFor !== org;

  const existingScores = useMemo(() => [
    ...(data?.unassigned ?? []),
    ...(data?.concerts.flatMap((c) => c.stages.flatMap((s) => s.programs.flatMap((p) => p.score ? [p.score] : []))) ?? []),
  ], [data]);

  useEffect(() => {
    let cancelled = false;
    scoresApi.grouped(org)
      .then((scoreData) => {
        if (cancelled) return;
        setData(scoreData);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => { if (!cancelled) setLoadedFor(org); });
    return () => { cancelled = true; };
  }, [org, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScoreCreated = (score: ScoreSummary, stageAssigned: boolean) => {
    if (stageAssigned) {
      setReloadTick((t) => t + 1);
    } else {
      setData((prev) => prev ? { ...prev, unassigned: [...prev.unassigned, score] } : prev);
    }
    setShowAddModal(false);
  };

  const totalScores = data
    ? data.concerts.reduce((n, c) => n + c.stages.reduce((m, s) => m + s.programs.length, 0), 0)
      + data.unassigned.length
    : 0;

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800">楽譜</h1>
            {!loading && data && (
              <span className="text-sm text-gray-400">{totalScores}曲</span>
            )}
          </div>
          {roles.includes("admin") && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus size={14} />
              曲目を追加
            </button>
          )}
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && data && (
          <>
            {data.concerts.length === 0 && data.unassigned.length === 0 && (
              <div className="text-center py-16 text-gray-400">
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
