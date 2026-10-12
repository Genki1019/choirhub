"use client";

import type { ReactNode } from "react";
import { Pencil, ArrowRightLeft, Plus } from "lucide-react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DragHandle, SortableItem, useListDndSensors } from "@/components/SortableRow";
import { reorderByDragEvent } from "@/lib/sort-order";
import { type ConcertDetail, type ProgramDetail, type StageDetail } from "@/lib/concerts-api";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { useInlineEdit } from "@/hooks/useInlineEdit";

function StageTitle({
  stage,
  isAdmin,
  dragHandle,
  onRename,
}: {
  stage: StageDetail;
  isAdmin: boolean;
  dragHandle: ReactNode;
  onRename: (name: string) => Promise<void>;
}) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => stage.name,
    validate: (name) => (name.trim() ? null : "ステージ名を入力してください"),
    onSave: (name) => onRename(name.trim()),
    errorFallback: "ステージ名の保存に失敗しました。もう一度お試しください。",
  });

  return (
    <div className="mb-3 space-y-1">
      <div className="flex items-center gap-2">
        {isAdmin && !edit.editing && dragHandle}
        {edit.editing ? (
          <input
            aria-label="ステージ名"
            value={edit.value}
            onChange={(e) => edit.setValue(e.target.value)}
            onKeyDown={edit.handleKeyDown}
            className="border-brand-400 min-w-0 flex-1 border-b bg-transparent py-0.5 text-sm font-semibold text-gray-700 focus:outline-none"
            autoFocus
          />
        ) : (
          <h3 className="shrink-0 text-sm font-semibold text-gray-700">{stage.name}</h3>
        )}
        <div className="h-px flex-1 bg-gray-200" />
        {isAdmin &&
          (edit.editing ? (
            <InlineEditActions
              label="ステージ名"
              saving={edit.saving}
              onSave={edit.save}
              onCancel={edit.cancel}
            />
          ) : (
            <InlineEditButton
              ref={registerTrigger}
              label={`${stage.name}の名前`}
              onClick={edit.start}
            />
          ))}
      </div>
      <ErrorMessage>{edit.error}</ErrorMessage>
    </div>
  );
}

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
                    <StageTitle
                      stage={stage}
                      isAdmin={isAdmin}
                      onRename={(name) => onEditStageName(stage.id, name)}
                      dragHandle={
                        <DragHandle
                          label={stage.name}
                          attributes={stageRow.attributes}
                          listeners={stageRow.listeners}
                        />
                      }
                    />

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
                                        type="button"
                                        onClick={() => onEditProgramClick(stage.id, program)}
                                        className="hover:text-brand-500 rounded p-1 text-gray-300 transition-colors"
                                        title="編集"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
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
                          type="button"
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
          type="button"
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
