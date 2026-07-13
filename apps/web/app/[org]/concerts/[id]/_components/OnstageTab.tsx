"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  concertsApi,
  type ConcertDetail,
  type StageDetail,
  type FormationPatternDetail,
  type FormationBoxDetail,
  type FormationSlotDetail,
} from "@/lib/concerts-api";
import { FormationEditor } from "./onstage/FormationEditor";
import { ReadOnlyFormation } from "./onstage/ReadOnlyFormation";
import { StatusPillList } from "./onstage/StatusPillList";
import { buildPartColorMap } from "./onstage/formation-model";

interface OnstageTabProps {
  concert: ConcertDetail;
  org: string;
  canManageStage: boolean;
  onStagesChanged: (stages: StageDetail[]) => void;
}

function pillButtonClass(active: boolean): string {
  return [
    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
    active
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-gray-600 border-gray-300 hover:border-brand-300 hover:text-brand-600",
  ].join(" ");
}

const iconButtonClass = "text-gray-400 hover:text-gray-600 disabled:opacity-25 p-1";

// 入力中の文字はこのコンポーネント内だけの state にとどめ、1文字打つたびに
// OnstageTab（延いては配下の FormationEditor 全体）が再レンダリングされるのを避ける
function PatternRenameInput({
  initialName, onCommit, onCancel,
}: {
  initialName: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => onCommit(name)}
      onKeyDown={(e) => { if (e.key === "Enter") onCommit(name); if (e.key === "Escape") onCancel(); }}
      className="text-xs border border-brand-300 rounded-lg px-2 py-1.5 w-28"
    />
  );
}

export function OnstageTab({ concert, org, canManageStage, onStagesChanged }: OnstageTabProps) {
  const stages = concert.stages;
  const [selectedStageId, setSelectedStageId] = useState<string | null>(stages[0]?.id ?? null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const renamingIdRef = useRef<string | null>(null);

  if (concert.assignments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">オンステ確定後に、出演メンバーとフォーメーションがここに表示されます</p>
      </div>
    );
  }

  if (stages.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">ステージが登録されていません</p>;
  }

  const stageId = selectedStageId ?? stages[0].id;
  const stage = stages.find((s) => s.id === stageId) ?? stages[0];
  const patterns = stage.formationPatterns ?? [];
  const patternId = selectedPatternId && patterns.some((p) => p.id === selectedPatternId) ? selectedPatternId : patterns[0]?.id ?? null;
  const pattern = patterns.find((p) => p.id === patternId) ?? null;

  const stageAssignments = concert.assignments.filter((a) => a.stageId === stageId);
  const offMembers = stageAssignments.filter((a) => a.status === "off");
  const undecidedMembers = stageAssignments.filter((a) => a.status === "undecided");
  const partColorMap = buildPartColorMap(stageAssignments);

  const updateStagePatterns = (updater: (patterns: FormationPatternDetail[]) => FormationPatternDetail[]) => {
    onStagesChanged(stages.map((s) => (s.id === stageId ? { ...s, formationPatterns: updater(s.formationPatterns ?? []) } : s)));
  };

  // 呼び出し側で楽観的更新を適用済みの前提。失敗時のみ revert する
  const persistPatternChange = async (request: () => Promise<unknown>, revert: () => void, errorMessage: string) => {
    try {
      await request();
    } catch {
      revert();
      setError(errorMessage);
    }
  };

  // 既存パターン名「パターンN」の最大 N + 1 を使う（削除後に patterns.length ベースだと名前が衝突するため）
  const nextPatternName = () => {
    const usedNumbers = patterns
      .map((p) => /^パターン(\d+)$/.exec(p.name)?.[1])
      .filter((n): n is string => n != null)
      .map(Number);
    return `パターン${usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : patterns.length + 1}`;
  };

  const handleCreatePattern = async () => {
    try {
      const created = await concertsApi.createFormationPattern(org, concert.id, stageId, nextPatternName());
      updateStagePatterns((prev) => [...prev, created]);
      setSelectedPatternId(created.id);
    } catch {
      setError("パターンの作成に失敗しました。もう一度お試しください。");
    }
  };

  const handleRenamePattern = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { setEditingPatternId(null); return; }
    if (renamingIdRef.current === id) return; // Enter → blur の連続発火による二重送信を防ぐ
    renamingIdRef.current = id;
    try {
      await concertsApi.updateFormationPattern(org, concert.id, stageId, id, { name: trimmed });
      updateStagePatterns((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
      setEditingPatternId(null);
    } catch {
      setError("パターン名の変更に失敗しました。もう一度お試しください。");
    } finally {
      renamingIdRef.current = null;
    }
  };

  const handleMovePattern = (id: string, dir: -1 | 1) => {
    const idx = patterns.findIndex((p) => p.id === id);
    const newIdx = idx + dir;
    if (idx === -1 || newIdx < 0 || newIdx >= patterns.length) return;
    const reordered = [...patterns];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const prevPatterns = patterns;
    updateStagePatterns(() => reordered);
    persistPatternChange(
      () => concertsApi.reorderFormationPatterns(org, concert.id, stageId, reordered.map((p) => p.id)),
      () => updateStagePatterns(() => prevPatterns),
      "パターンの並び替えに失敗しました。もう一度お試しください。",
    );
  };

  const handleDeletePattern = async (id: string) => {
    try {
      await concertsApi.deleteFormationPattern(org, concert.id, stageId, id);
      updateStagePatterns((prev) => prev.filter((p) => p.id !== id));
      if (selectedPatternId === id) setSelectedPatternId(null);
    } catch {
      setError("パターンの削除に失敗しました。もう一度お試しください。");
    }
  };

  const handleFormationChanged = (boxes: FormationBoxDetail[], slots: FormationSlotDetail[]) => {
    if (!pattern) return;
    updateStagePatterns((prev) => prev.map((p) => (p.id === pattern.id ? { ...p, boxes, slots } : p)));
  };

  const handlePatternPatch = <K extends "isStaggered" | "pianoPosition">(key: K, value: FormationPatternDetail[K]) => {
    if (!pattern) return;
    const prevValue = pattern[key];
    updateStagePatterns((prev) => prev.map((p) => (p.id === pattern.id ? { ...p, [key]: value } : p)));
    persistPatternChange(
      () => concertsApi.updateFormationPattern(org, concert.id, stageId, pattern.id, { [key]: value }),
      () => updateStagePatterns((prev) => prev.map((p) => (p.id === pattern.id ? { ...p, [key]: prevValue } : p))),
      "設定の変更に失敗しました。もう一度お試しください。",
    );
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {stages.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedStageId(s.id); setSelectedPatternId(null); }}
              className={pillButtonClass(stageId === s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">フォーメーション</h3>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            {patterns.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-1">
                {editingPatternId === p.id ? (
                  <PatternRenameInput
                    initialName={p.name}
                    onCommit={(name) => handleRenamePattern(p.id, name)}
                    onCancel={() => setEditingPatternId(null)}
                  />
                ) : (
                  <button onClick={() => setSelectedPatternId(p.id)} className={pillButtonClass(patternId === p.id)}>
                    {p.name}
                  </button>
                )}
                {canManageStage && editingPatternId !== p.id && (
                  <>
                    <button onClick={() => handleMovePattern(p.id, -1)} disabled={idx === 0} className={iconButtonClass} title="前へ">
                      <ChevronLeft size={11} />
                    </button>
                    <button
                      onClick={() => handleMovePattern(p.id, 1)}
                      disabled={idx === patterns.length - 1}
                      className={iconButtonClass}
                      title="後へ"
                    >
                      <ChevronRight size={11} />
                    </button>
                    <button onClick={() => setEditingPatternId(p.id)} className={iconButtonClass} title="名称変更">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => handleDeletePattern(p.id)} className="text-gray-400 hover:text-red-500 p-1" title="削除">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {canManageStage && (
              <button
                onClick={handleCreatePattern}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-dashed border-gray-300 hover:border-brand-300 hover:text-brand-500 transition-colors"
              >
                <Plus size={12} /> 新しいパターン
              </button>
            )}
          </div>
          {canManageStage && pattern && (
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === "edit" ? "preview" : "edit"))}
              className={`flex items-center gap-1 shrink-0 ${pillButtonClass(viewMode === "preview")}`}
            >
              <Eye size={12} /> プレビュー
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {!pattern && (
            <p className="text-xs text-gray-400 text-center py-8">
              {canManageStage ? "「新しいパターン」からフォーメーションを作成してください" : "フォーメーションパターンがまだ作成されていません"}
            </p>
          )}
          {pattern && (canManageStage && viewMode === "edit" ? (
            <FormationEditor
              key={pattern.id}
              org={org}
              concertId={concert.id}
              stageId={stageId}
              pattern={pattern}
              stageAssignments={stageAssignments}
              partColorMap={partColorMap}
              onFormationChanged={handleFormationChanged}
              onIsStaggeredChanged={(isStaggered) => handlePatternPatch("isStaggered", isStaggered)}
              onPianoPositionChanged={(pianoPosition) => handlePatternPatch("pianoPosition", pianoPosition)}
            />
          ) : (
            <ReadOnlyFormation pattern={pattern} partColorMap={partColorMap} />
          ))}
        </div>
      </section>

      <StatusPillList title="オフステ" members={offMembers} partColorMap={partColorMap} />
      <StatusPillList title="回答なし" members={undecidedMembers} partColorMap={partColorMap} />
    </div>
  );
}
