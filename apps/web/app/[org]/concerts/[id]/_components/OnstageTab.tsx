"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Plus, Trash2, Users } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { useInlineEdit } from "@/hooks/useInlineEdit";

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

function PatternItem({
  pattern,
  active,
  isFirst,
  isLast,
  canManageStage,
  onSelect,
  onMove,
  onDelete,
  onRename,
}: {
  pattern: FormationPatternDetail;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
  canManageStage: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => pattern.name,
    validate: (name) => (name.trim() ? null : "パターン名を入力してください"),
    onSave: (name) => onRename(name.trim()),
    errorFallback: "パターン名の変更に失敗しました。もう一度お試しください。",
  });

  return (
    <div>
      <div className="flex items-center gap-1">
        {edit.editing ? (
          <>
            <input
              autoFocus
              aria-label="パターン名"
              value={edit.value}
              onChange={(e) => edit.setValue(e.target.value)}
              onKeyDown={edit.handleKeyDown}
              className="border-brand-300 w-28 rounded-lg border px-2 py-1.5 text-xs"
            />
            <InlineEditActions
              label="パターン名"
              size="sm"
              saving={edit.saving}
              onSave={edit.save}
              onCancel={edit.cancel}
            />
          </>
        ) : (
          <button type="button" onClick={onSelect} className={pillButtonClass(active)}>
            {pattern.name}
          </button>
        )}
        {canManageStage && !edit.editing && (
          <>
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={isFirst}
              className={iconButtonClass}
              title="前へ"
            >
              <ChevronLeft size={11} />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={isLast}
              className={iconButtonClass}
              title="後へ"
            >
              <ChevronRight size={11} />
            </button>
            <InlineEditButton
              ref={registerTrigger}
              label={pattern.name}
              size="sm"
              onClick={edit.start}
            />
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-500"
              aria-label={`${pattern.name}を削除`}
              title="削除"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
      <ErrorMessage className="mt-1">{edit.error}</ErrorMessage>
    </div>
  );
}

export function OnstageTab({ concert, org, canManageStage, onStagesChanged }: OnstageTabProps) {
  const stages = concert.stages;
  const [selectedStageId, setSelectedStageId] = useState<string | null>(stages[0]?.id ?? null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [confirmPattern, setConfirmPattern] = useState<{ id: string; name: string } | null>(null);
  const [deletingPattern, setDeletingPattern] = useState(false);
  const [deletePatternError, setDeletePatternError] = useState<string | null>(null);

  if (concert.assignments.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Users size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">
          オンステ確定後に、出演メンバーとフォーメーションがここに表示されます
        </p>
      </div>
    );
  }

  if (stages.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">ステージが登録されていません</p>;
  }

  const stageId = selectedStageId ?? stages[0].id;
  const stage = stages.find((s) => s.id === stageId) ?? stages[0];
  const patterns = stage.formationPatterns ?? [];
  const patternId =
    selectedPatternId && patterns.some((p) => p.id === selectedPatternId)
      ? selectedPatternId
      : (patterns[0]?.id ?? null);
  const pattern = patterns.find((p) => p.id === patternId) ?? null;

  const stageAssignments = concert.assignments.filter((a) => a.stageId === stageId);
  const offMembers = stageAssignments.filter((a) => a.status === "off");
  const undecidedMembers = stageAssignments.filter((a) => a.status === "undecided");
  const partColorMap = buildPartColorMap(stageAssignments);

  const updateStagePatterns = (
    updater: (patterns: FormationPatternDetail[]) => FormationPatternDetail[],
  ) => {
    onStagesChanged(
      stages.map((s) =>
        s.id === stageId ? { ...s, formationPatterns: updater(s.formationPatterns ?? []) } : s,
      ),
    );
  };

  // 呼び出し側で楽観的更新を適用済みの前提。失敗時のみ revert する
  const persistPatternChange = async (
    request: () => Promise<unknown>,
    revert: () => void,
    errorMessage: string,
  ) => {
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
      const created = await concertsApi.createFormationPattern(
        org,
        concert.id,
        stageId,
        nextPatternName(),
      );
      updateStagePatterns((prev) => [...prev, created]);
      setSelectedPatternId(created.id);
    } catch {
      setError("パターンの作成に失敗しました。もう一度お試しください。");
    }
  };

  const handleRenamePattern = async (id: string, name: string) => {
    await concertsApi.updateFormationPattern(org, concert.id, stageId, id, { name });
    updateStagePatterns((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
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
      () =>
        concertsApi.reorderFormationPatterns(
          org,
          concert.id,
          stageId,
          reordered.map((p) => p.id),
        ),
      () => updateStagePatterns(() => prevPatterns),
      "パターンの並び替えに失敗しました。もう一度お試しください。",
    );
  };

  const handleDeletePattern = async (id: string) => {
    setDeletingPattern(true);
    setDeletePatternError(null);
    try {
      await concertsApi.deleteFormationPattern(org, concert.id, stageId, id);
      updateStagePatterns((prev) => prev.filter((p) => p.id !== id));
      if (selectedPatternId === id) setSelectedPatternId(null);
      setConfirmPattern(null);
    } catch {
      setDeletePatternError("パターンの削除に失敗しました。もう一度お試しください。");
    } finally {
      setDeletingPattern(false);
    }
  };

  const handleFormationChanged = (boxes: FormationBoxDetail[], slots: FormationSlotDetail[]) => {
    if (!pattern) return;
    updateStagePatterns((prev) =>
      prev.map((p) => (p.id === pattern.id ? { ...p, boxes, slots } : p)),
    );
  };

  const handlePatternPatch = <K extends "isStaggered" | "pianoPosition">(
    key: K,
    value: FormationPatternDetail[K],
  ) => {
    if (!pattern) return;
    const prevValue = pattern[key];
    updateStagePatterns((prev) =>
      prev.map((p) => (p.id === pattern.id ? { ...p, [key]: value } : p)),
    );
    persistPatternChange(
      () =>
        concertsApi.updateFormationPattern(org, concert.id, stageId, pattern.id, { [key]: value }),
      () =>
        updateStagePatterns((prev) =>
          prev.map((p) => (p.id === pattern.id ? { ...p, [key]: prevValue } : p)),
        ),
      "設定の変更に失敗しました。もう一度お試しください。",
    );
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {stages.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => {
                setSelectedStageId(s.id);
                setSelectedPatternId(null);
              }}
              className={pillButtonClass(stageId === s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700">フォーメーション</h3>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {patterns.map((p, idx) => (
              <PatternItem
                key={p.id}
                pattern={p}
                active={patternId === p.id}
                isFirst={idx === 0}
                isLast={idx === patterns.length - 1}
                canManageStage={canManageStage}
                onSelect={() => setSelectedPatternId(p.id)}
                onMove={(dir) => handleMovePattern(p.id, dir)}
                onDelete={() => {
                  setDeletePatternError(null);
                  setConfirmPattern({ id: p.id, name: p.name });
                }}
                onRename={(name) => handleRenamePattern(p.id, name)}
              />
            ))}
            {canManageStage && (
              <button
                type="button"
                onClick={handleCreatePattern}
                className="hover:border-brand-300 hover:text-brand-500 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition-colors"
              >
                <Plus size={12} /> 新しいパターン
              </button>
            )}
          </div>
          {canManageStage && pattern && (
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === "edit" ? "preview" : "edit"))}
              className={`flex shrink-0 items-center gap-1 ${pillButtonClass(viewMode === "preview")}`}
            >
              <Eye size={12} /> プレビュー
            </button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {!pattern && (
            <p className="py-8 text-center text-xs text-gray-400">
              {canManageStage
                ? "「新しいパターン」からフォーメーションを作成してください"
                : "フォーメーションパターンがまだ作成されていません"}
            </p>
          )}
          {pattern &&
            (canManageStage && viewMode === "edit" ? (
              <FormationEditor
                key={pattern.id}
                org={org}
                concertId={concert.id}
                stageId={stageId}
                pattern={pattern}
                stageAssignments={stageAssignments}
                partColorMap={partColorMap}
                onFormationChanged={handleFormationChanged}
                onIsStaggeredChanged={(isStaggered) =>
                  handlePatternPatch("isStaggered", isStaggered)
                }
                onPianoPositionChanged={(pianoPosition) =>
                  handlePatternPatch("pianoPosition", pianoPosition)
                }
              />
            ) : (
              <ReadOnlyFormation pattern={pattern} partColorMap={partColorMap} />
            ))}
        </div>
      </section>

      <StatusPillList title="オフステ" members={offMembers} partColorMap={partColorMap} />
      <StatusPillList title="回答なし" members={undecidedMembers} partColorMap={partColorMap} />

      {confirmPattern && (
        <ConfirmDialog
          title="パターンを削除しますか？"
          description={`「${confirmPattern.name}」と、その立ち位置の配置を削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deletingPattern}
          error={deletePatternError}
          onCancel={() => setConfirmPattern(null)}
          onConfirm={() => handleDeletePattern(confirmPattern.id)}
        />
      )}
    </div>
  );
}
