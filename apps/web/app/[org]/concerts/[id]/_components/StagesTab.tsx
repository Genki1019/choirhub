"use client";

import { useState, useRef } from "react";
import { Loader2, Check, X, Pencil, ArrowRightLeft, Plus } from "lucide-react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DragHandle, SortableItem, useListDndSensors } from "@/components/SortableRow";
import { reorderByDragEvent } from "@/lib/sort-order";
import { type ConcertDetail, type ProgramDetail, type StageDetail } from "@/lib/concerts-api";

interface StagesTabProps {
  concert: ConcertDetail;
  isAdmin: boolean;
  onAddClick: (stageId: string) => void;
  onAddStage: () => void;
  onReorderStages: (orderedIds: string[]) => void;
  onReorderPrograms: (stageId: string, orderedIds: string[]) => void;
  onEditStageName: (stageId: string, name: string) => Promise<void>;
  onMoveCopyClick: (stageId: string, program: ProgramDetail) => void;
  onEditProgramClick: (stageId: string, program: ProgramDetail) => void;
}

export function StagesTab({
  concert,
  isAdmin,
  onAddClick,
  onAddStage,
  onReorderStages,
  onReorderPrograms,
  onEditStageName,
  onMoveCopyClick,
  onEditProgramClick,
}: StagesTabProps) {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const sensors = useListDndSensors();

  const handleStageDragEnd = (event: DragEndEvent) => {
    const moved = reorderByDragEvent(concert.stages, event);
    if (moved) onReorderStages(moved.map((s) => s.id));
  };

  const handleProgramDragEnd = (stageId: string, event: DragEndEvent) => {
    const stage = concert.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const moved = reorderByDragEvent(stage.programs, event);
    if (moved)
      onReorderPrograms(
        stageId,
        moved.map((p) => p.id),
      );
  };

  const startEdit = (stage: StageDetail) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
  };

  const cancelEdit = () => setEditingStageId(null);

  const saveEdit = async (stageId: string) => {
    if (savingRef.current) return;
    const trimmed = editStageName.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    savingRef.current = true;
    setSavingStageId(stageId);
    try {
      await onEditStageName(stageId, trimmed);
    } finally {
      savingRef.current = false;
      setSavingStageId(null);
      setEditingStageId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DndContext sensors={sensors} onDragEnd={handleStageDragEnd}>
        <SortableContext
          items={concert.stages.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {concert.stages.map((stage) => (
              <SortableItem key={stage.id} id={stage.id}>
                {(stageRow) => (
                  <section ref={stageRow.setNodeRef} style={stageRow.style} data-dnd-row="">
                    <div className="mb-3 flex items-center gap-2">
                      {isAdmin && editingStageId !== stage.id && (
                        <DragHandle
                          label={stage.name}
                          attributes={stageRow.attributes}
                          listeners={stageRow.listeners}
                        />
                      )}
                      {editingStageId === stage.id ? (
                        <input
                          value={editStageName}
                          onChange={(e) => setEditStageName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(stage.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="border-brand-400 min-w-0 flex-1 border-b bg-transparent py-0.5 text-sm font-semibold text-gray-700 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <h3 className="shrink-0 text-sm font-semibold text-gray-700">
                          {stage.name}
                        </h3>
                      )}
                      <div className="h-px flex-1 bg-gray-200" />
                      {isAdmin && editingStageId === stage.id && (
                        <div className="flex shrink-0 items-center gap-1">
                          {savingStageId === stage.id ? (
                            <Loader2 size={13} className="text-brand-400 animate-spin" />
                          ) : (
                            <>
                              <button
                                onClick={() => saveEdit(stage.id)}
                                aria-label="保存"
                                className="rounded p-1 text-green-600 transition-colors hover:text-green-700"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                aria-label="キャンセル"
                                className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600"
                              >
                                <X size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {isAdmin && editingStageId !== stage.id && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={() => startEdit(stage)}
                            className="hover:text-brand-500 rounded p-1 text-gray-400 transition-colors"
                            title="名前を編集"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <DndContext
                        sensors={sensors}
                        onDragEnd={(event) => handleProgramDragEnd(stage.id, event)}
                      >
                        <SortableContext
                          items={stage.programs.map((p) => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {stage.programs.map((program, progIdx) => (
                            <SortableItem key={program.id} id={program.id}>
                              {(progRow) => (
                                <div
                                  ref={progRow.setNodeRef}
                                  style={progRow.style}
                                  data-dnd-row=""
                                  className={`flex items-center gap-3 px-5 py-4 ${progIdx < stage.programs.length - 1 || isAdmin ? "border-b border-gray-100" : ""}`}
                                >
                                  {isAdmin && (
                                    <DragHandle
                                      label={program.title}
                                      attributes={progRow.attributes}
                                      listeners={progRow.listeners}
                                    />
                                  )}
                                  <span className="w-5 shrink-0 font-mono text-sm text-gray-400">
                                    {progIdx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-800">
                                      {program.title}
                                    </p>
                                    {program.score && (
                                      <p className="mt-0.5 text-xs text-gray-400">
                                        {[
                                          program.score.composer
                                            ? `${program.score.composer} 作曲`
                                            : null,
                                          program.score.arranger
                                            ? `${program.score.arranger} 編曲`
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" / ")}
                                      </p>
                                    )}
                                  </div>
                                  {isAdmin && (
                                    <div className="flex shrink-0 items-center gap-0.5">
                                      <button
                                        onClick={() => onEditProgramClick(stage.id, program)}
                                        className="hover:text-brand-500 rounded p-1 text-gray-300 transition-colors"
                                        title="編集"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        onClick={() => onMoveCopyClick(stage.id, program)}
                                        className="hover:text-brand-500 rounded p-1 text-gray-300 transition-colors"
                                        title="移動 / コピー"
                                      >
                                        <ArrowRightLeft size={13} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </SortableItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                      {isAdmin && (
                        <button
                          onClick={() => onAddClick(stage.id)}
                          className="hover:text-brand-500 hover:bg-brand-50 flex w-full items-center gap-2 px-5 py-3 text-xs text-gray-400 transition-colors"
                        >
                          <Plus size={12} />
                          曲目を追加
                        </button>
                      )}
                    </div>
                  </section>
                )}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {concert.stages.length === 0 && !isAdmin && (
        <p className="py-8 text-center text-sm text-gray-400">ステージ・演目が登録されていません</p>
      )}

      {isAdmin && (
        <button
          onClick={onAddStage}
          className="hover:text-brand-500 hover:border-brand-300 hover:bg-brand-50 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-3 text-xs text-gray-400 transition-colors"
        >
          <Plus size={12} />
          ステージを追加
        </button>
      )}
    </div>
  );
}
