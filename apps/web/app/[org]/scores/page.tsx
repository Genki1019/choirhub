"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, BookOpen } from "lucide-react";
import {
  scoresApi,
  type ConcertWithScores,
  type ScoreSummary,
  type ScoreFile,
} from "@/lib/scores-api";
import { ApiClientError } from "@/lib/api-client";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { settingsApi, type MemberType } from "@/lib/settings-api";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { MidiModal } from "./_components/MidiModal";
import { PurchaseModal } from "./_components/PurchaseModal";
import { FileManageModal } from "./_components/FileManageModal";
import { AddScoreModal } from "./_components/AddScoreModal";
import { ConcertSection } from "./_components/ConcertSection";
import { UnassignedSection } from "./_components/UnassignedSection";
import { CollectionModal } from "../accounting/_components/CollectionModal";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function ScoresPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();

  const [data, setData] = useState<{ concerts: ConcertWithScores[]; unassigned: ScoreSummary[] } | null>(null);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [midiTarget, setMidiTarget] = useState<ScoreSummary | null>(null);
  const [purchaseTarget, setPurchaseTarget] = useState<ScoreSummary | null>(null);
  const [fileManageTarget, setFileManageTarget] = useState<ScoreSummary | null>(null);
  const [collectionTarget, setCollectionTarget] = useState<ScoreSummary | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loading = loadedFor !== org;

  const isAdmin        = myRoles.includes("admin");
  const isPrivileged   = isAdmin || myRoles.includes("score");
  const canManagePdf   = isAdmin || myRoles.includes("score");
  const canManageMidi  = isAdmin || myRoles.includes("tech");
  const isFileManager  = canManagePdf || canManageMidi;
  const canSetPrice    = isPrivileged;
  const canViewPrice   = myRoles.some((r) => MEMBER_LEVEL_ROLES.has(r));

  const reload = () => {
    setLoadedFor(null);
    setReloadTick((t) => t + 1);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([scoresApi.grouped(org), membersApi.me(org), membersApi.parts(org), settingsApi.listMemberTypes(org)])
      .then(([scoreData, me, partData, types]) => {
        if (cancelled) return;
        setData(scoreData);
        setMyRoles(me.roles);
        setParts(partData);
        setMemberTypes(types);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => { if (!cancelled) setLoadedFor(org); });
    return () => { cancelled = true; };
  }, [org, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateScoreFiles = useCallback((scoreId: string, updatedFiles: ScoreFile[]) => {
    setData((prev) => {
      if (!prev) return prev;
      if (prev.unassigned.some((s) => s.id === scoreId)) {
        return { ...prev, unassigned: prev.unassigned.map((s) => s.id === scoreId ? { ...s, files: updatedFiles } : s) };
      }
      const idx = prev.concerts.findIndex((c) =>
        c.stages.some((st) => st.programs.some((p) => p.score?.id === scoreId))
      );
      if (idx === -1) return prev;
      const concerts = [...prev.concerts];
      const c = concerts[idx];
      concerts[idx] = {
        ...c,
        stages: c.stages.map((st) => ({
          ...st,
          programs: st.programs.map((p) => ({
            ...p,
            score: p.score?.id === scoreId ? { ...p.score, files: updatedFiles } : p.score,
          })),
        })),
      };
      return { ...prev, concerts };
    });
  }, []);

  const updateScorePrice = useCallback((scoreId: string, price: number | null) => {
    setData((prev) => {
      if (!prev) return prev;
      if (prev.unassigned.some((s) => s.id === scoreId)) {
        return { ...prev, unassigned: prev.unassigned.map((s) => s.id === scoreId ? { ...s, distributionPrice: price } : s) };
      }
      const idx = prev.concerts.findIndex((c) =>
        c.stages.some((st) => st.programs.some((p) => p.score?.id === scoreId))
      );
      if (idx === -1) return prev;
      const concerts = [...prev.concerts];
      const c = concerts[idx];
      concerts[idx] = {
        ...c,
        stages: c.stages.map((st) => ({
          ...st,
          programs: st.programs.map((p) => ({
            ...p,
            score: p.score?.id === scoreId ? { ...p.score, distributionPrice: price } : p.score,
          })),
        })),
      };
      return { ...prev, concerts };
    });
  }, []);

  const handleScoreCreated = (score: ScoreSummary) => {
    setData((prev) => prev ? { ...prev, unassigned: [...prev.unassigned, score] } : prev);
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
          {isAdmin && (
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
              <ConcertSection
                key={concert.id}
                concert={concert}
                orgSlug={org}
                onMidiClick={setMidiTarget}
                onPurchaseClick={setPurchaseTarget}
                onFileManage={setFileManageTarget}
                onCreateCollection={isPrivileged ? setCollectionTarget : undefined}
                isPrivileged={isPrivileged}
                isFileManager={isFileManager}
                canViewPrice={canViewPrice}
                canSetPrice={canSetPrice}
                onPriceUpdate={updateScorePrice}
              />
            ))}

            <UnassignedSection
              scores={data.unassigned}
              orgSlug={org}
              onMidiClick={setMidiTarget}
              onPurchaseClick={setPurchaseTarget}
              onFileManage={setFileManageTarget}
              onCreateCollection={isPrivileged ? setCollectionTarget : undefined}
              isPrivileged={isPrivileged}
              isFileManager={isFileManager}
              canViewPrice={canViewPrice}
              canSetPrice={canSetPrice}
              onPriceUpdate={updateScorePrice}
            />
          </>
        )}
      </PageMain>

      {midiTarget && (
        <MidiModal score={midiTarget} onClose={() => setMidiTarget(null)} />
      )}

      {purchaseTarget && (
        <PurchaseModal
          orgSlug={org}
          score={purchaseTarget}
          onClose={() => { setPurchaseTarget(null); reload(); }}
        />
      )}

      {showAddModal && (
        <AddScoreModal
          orgSlug={org}
          onClose={() => setShowAddModal(false)}
          onCreated={handleScoreCreated}
        />
      )}

      {fileManageTarget && (
        <FileManageModal
          orgSlug={org}
          score={fileManageTarget}
          parts={parts}
          canManagePdf={canManagePdf}
          canManageMidi={canManageMidi}
          onClose={(updatedFiles) => {
            updateScoreFiles(fileManageTarget.id, updatedFiles);
            setFileManageTarget(null);
          }}
        />
      )}

      {collectionTarget && (
        <CollectionModal
          org={org}
          memberTypes={memberTypes}
          initialTitle={collectionTarget.title}
          initialAmount={collectionTarget.distributionPrice ?? undefined}
          onClose={() => setCollectionTarget(null)}
          onSaved={() => setCollectionTarget(null)}
        />
      )}
    </div>
  );
}
