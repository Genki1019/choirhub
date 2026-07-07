"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, MapPin, Music, ClipboardList,
  Users, Loader2, AlertCircle, Pencil, Trash2,
} from "lucide-react";
import { useEffect } from "react";
import {
  concertsApi,
  type ConcertDetail,
  type ConcertStatus,
  type SurveySummary,
  type ProgramDetail,
  type StageDetail,
} from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";
import { useMember } from "@/contexts/MemberContext";
import { StagesTab } from "./_components/StagesTab";
import { AddStageModal } from "./_components/AddStageModal";
import { AddProgramModal } from "./_components/AddProgramModal";
import { MoveCopyModal, type MoveCopyTarget } from "./_components/MoveCopyModal";
import { SurveyTab } from "./_components/SurveyTab";
import { OnstageTab } from "./_components/OnstageTab";
import { EditConcertModal } from "./_components/EditConcertModal";
import { EditProgramModal } from "./_components/EditProgramModal";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

const STATUS_CONFIG: Record<ConcertStatus, { label: string; badge: string }> = {
  draft:       { label: "準備中",   badge: "bg-gray-100 text-gray-500" },
  survey_open: { label: "調査中",   badge: "bg-amber-100 text-amber-700" },
  confirmed:   { label: "確定済み", badge: "bg-green-100 text-green-700" },
  past:        { label: "終了",     badge: "bg-gray-100 text-gray-400" },
};

type Tab = "stages" | "survey" | "onstage";

const VALID_TABS: Tab[] = ["stages", "survey", "onstage"];

export default function ConcertDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "stages";
  const fromParam = searchParams.get("from");
  const backHref = fromParam === "schedule" ? `/${org}/schedule` : `/${org}/concerts`;
  const [concert, setConcert] = useState<ConcertDetail | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const { roles, memberId } = useMember();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addProgramStageId, setAddProgramStageId] = useState<string | null>(null);
  const [showAddStageModal, setShowAddStageModal] = useState(false);
  const [moveCopySource, setMoveCopySource] = useState<{ stageId: string; program: ProgramDetail } | null>(null);
  const [editProgramTarget, setEditProgramTarget] = useState<{ stageId: string; program: ProgramDetail } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    concertsApi.get(org, id)
      .then((data) => {
        setConcert(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        if (err instanceof ApiClientError && err.status === 404) { router.push(`/${org}/concerts`); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, id, router]);

  const handleStageAdded = (stage: StageDetail) => {
    setConcert((prev) => prev ? { ...prev, stages: [...prev.stages, stage] } : prev);
    setShowAddStageModal(false);
  };

  const handleMoveStage = (stageId: string, dir: -1 | 1) => {
    setConcert((prev) => {
      if (!prev) return prev;
      const idx = prev.stages.findIndex((s) => s.id === stageId);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.stages.length) return prev;
      const next = [...prev.stages];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      concertsApi.reorderStages(org, id, next.map((s) => s.id)).catch(() => {});
      return { ...prev, stages: next };
    });
  };

  const handleMoveProgram = (stageId: string, programId: string, dir: -1 | 1) => {
    setConcert((prev) => {
      if (!prev) return prev;
      const stageIdx = prev.stages.findIndex((s) => s.id === stageId);
      if (stageIdx === -1) return prev;
      const stage = prev.stages[stageIdx];
      const pIdx = stage.programs.findIndex((p) => p.id === programId);
      const newIdx = pIdx + dir;
      if (newIdx < 0 || newIdx >= stage.programs.length) return prev;
      const nextPrograms = [...stage.programs];
      [nextPrograms[pIdx], nextPrograms[newIdx]] = [nextPrograms[newIdx], nextPrograms[pIdx]];
      const nextStages = prev.stages.map((s, i) =>
        i === stageIdx ? { ...s, programs: nextPrograms } : s
      );
      concertsApi.reorderPrograms(org, id, stageId, nextPrograms.map((p) => p.id)).catch(() => {});
      return { ...prev, stages: nextStages };
    });
  };

  const handleEditStageName = async (stageId: string, name: string) => {
    await concertsApi.updateStage(org, id, stageId, { name });
    setConcert((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((s) => (s.id === stageId ? { ...s, name } : s)),
      };
    });
  };

  const handleMoveCopyComplete = (
    action: "move" | "copy",
    target: MoveCopyTarget,
    newProgram?: ProgramDetail
  ) => {
    if (!moveCopySource) return;
    const { stageId: sourceStageId, program: { id: sourceProgramId } } = moveCopySource;

    setConcert((prev) => {
      if (!prev) return prev;
      let stages = prev.stages;

      if (action === "move" || target.type === "unassigned") {
        stages = stages.map((s) =>
          s.id === sourceStageId
            ? { ...s, programs: s.programs.filter((p) => p.id !== sourceProgramId) }
            : s
        );
      }

      if (target.type === "stage" && target.concertId === prev.id && newProgram) {
        stages = stages.map((s) =>
          s.id === target.stageId
            ? { ...s, programs: [...s.programs, newProgram] }
            : s
        );
      }

      return { ...prev, stages };
    });

    setMoveCopySource(null);
  };

  const handleEditSaved = useCallback((updated: Partial<ConcertDetail>) => {
    setConcert((prev) => prev ? { ...prev, ...updated } : prev);
  }, []);

  const handleSurveysChanged = useCallback((surveys: SurveySummary[]) => {
    setConcert((prev) => prev ? { ...prev, surveys } : prev);
  }, []);

  const handleConcertStatusChanged = useCallback((status: ConcertStatus) => {
    setConcert((prev) => prev ? { ...prev, status } : prev);
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await concertsApi.delete(org, id);
      router.push(`/${org}/concerts`);
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleProgramAdded = (stageId: string, program: ProgramDetail) => {
    setConcert((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((s) =>
          s.id === stageId ? { ...s, programs: [...s.programs, program] } : s
        ),
      };
    });
    setAddProgramStageId(null);
  };

  const handleProgramEdited = (stageId: string, updated: ProgramDetail) => {
    setConcert((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((s) =>
          s.id === stageId
            ? { ...s, programs: s.programs.map((p) => (p.id === updated.id ? updated : p)) }
            : s
        ),
      };
    });
    setEditProgramTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !concert) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error ?? "演奏会が見つかりません"}</span>
        </div>
      </div>
    );
  }

  const s = STATUS_CONFIG[concert.status];
  const date = new Date(concert.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

  const totalPrograms = concert.stages.reduce((n, s) => n + s.programs.length, 0);
  const onCount = concert.assignments.filter((a) => a.status === "on").length;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "stages",  label: "ステージ構成", icon: <Music size={13} /> },
    { id: "survey",  label: "オンステ調査", icon: <ClipboardList size={13} /> },
    { id: "onstage", label: "出演メンバー", icon: <Users size={13} /> },
  ];

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center gap-4 py-4">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-800">{concert.title}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                {s.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <CalendarDays size={13} className="text-gray-400" />
                {dateStr}
              </span>
              {concert.venue && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(concert.venue)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                >
                  <MapPin size={13} className="text-brand-400 shrink-0" />
                  {concert.venue}
                </a>
              )}
            </div>
          </div>
          {roles.includes("admin") && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <Pencil size={13} />
                編集
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
                削除
              </button>
            </div>
          )}
        </PageBleedRow>

        <div className="border-t border-gray-100 bg-gray-50">
          <PageBleedRow className="flex items-center gap-6 py-2">
            <span className="text-xs text-gray-500">{concert.stages.length} ステージ</span>
            <span className="text-xs text-gray-500">{totalPrograms} 曲</span>
            {onCount > 0 && (
              <span className="text-xs text-green-600 font-medium">出演確定 {onCount}名</span>
            )}
          </PageBleedRow>
        </div>

        <PageBleedRow className="flex pt-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </PageBleedRow>
      </header>

      <PageMain>
        {activeTab === "stages"  && (
          <StagesTab
            concert={concert}
            isAdmin={roles.includes("admin")}
            onAddClick={setAddProgramStageId}
            onAddStage={() => setShowAddStageModal(true)}
            onMoveStage={handleMoveStage}
            onMoveProgram={handleMoveProgram}
            onEditStageName={handleEditStageName}
            onMoveCopyClick={(stageId, program) => setMoveCopySource({ stageId, program })}
            onEditProgramClick={(stageId, program) => setEditProgramTarget({ stageId, program })}
          />
        )}
        {activeTab === "survey" && (
          <SurveyTab
            concert={concert}
            org={org}
            isAdmin={roles.includes("admin")}
            myMemberId={memberId}
            onSurveysChanged={handleSurveysChanged}
            onConcertStatusChanged={handleConcertStatusChanged}
          />
        )}
        {activeTab === "onstage" && <OnstageTab concert={concert} />}
      </PageMain>

      {showAddStageModal && (
        <AddStageModal
          orgSlug={org}
          concertId={id}
          stageCount={concert.stages.length}
          onClose={() => setShowAddStageModal(false)}
          onCreated={handleStageAdded}
        />
      )}

      {addProgramStageId && (
        <AddProgramModal
          orgSlug={org}
          concertId={id}
          stageId={addProgramStageId}
          onClose={() => setAddProgramStageId(null)}
          onCreated={(program) => handleProgramAdded(addProgramStageId, program)}
        />
      )}

      {editProgramTarget && (
        <EditProgramModal
          orgSlug={org}
          concertId={id}
          program={editProgramTarget.program}
          onClose={() => setEditProgramTarget(null)}
          onSaved={(updated) => handleProgramEdited(editProgramTarget.stageId, updated)}
        />
      )}

      {moveCopySource && (
        <MoveCopyModal
          orgSlug={org}
          concertId={id}
          stageId={moveCopySource.stageId}
          program={moveCopySource.program}
          onClose={() => setMoveCopySource(null)}
          onComplete={handleMoveCopyComplete}
        />
      )}

      {showEditModal && (
        <EditConcertModal
          concert={concert}
          orgSlug={org}
          onClose={() => setShowEditModal(false)}
          onSaved={handleEditSaved}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm px-6 py-6">
            <h2 className="font-semibold text-gray-800 mb-2">演奏会を削除しますか？</h2>
            <p className="text-sm text-gray-500 mb-5">
              「{concert.title}」を削除します。ステージ・曲目・スケジュール連携も全て削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                削除する
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-sm text-gray-500 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
