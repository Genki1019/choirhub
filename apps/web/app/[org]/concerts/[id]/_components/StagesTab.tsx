"use client";

import { useState, useRef } from "react";
import {
  Loader2, Check, X, ChevronUp, ChevronDown,
  Pencil, ArrowRightLeft, Plus,
} from "lucide-react";
import { type ConcertDetail, type ProgramDetail, type StageDetail } from "@/lib/concerts-api";

interface StagesTabProps {
  concert: ConcertDetail;
  isAdmin: boolean;
  onAddClick: (stageId: string) => void;
  onAddStage: () => void;
  onMoveStage: (stageId: string, dir: -1 | 1) => void;
  onMoveProgram: (stageId: string, programId: string, dir: -1 | 1) => void;
  onEditStageName: (stageId: string, name: string) => Promise<void>;
  onMoveCopyClick: (stageId: string, program: ProgramDetail) => void;
  onEditProgramClick: (stageId: string, program: ProgramDetail) => void;
}

export function StagesTab({
  concert, isAdmin, onAddClick, onAddStage, onMoveStage, onMoveProgram, onEditStageName, onMoveCopyClick, onEditProgramClick,
}: StagesTabProps) {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const savingRef = useRef(false);

  const startEdit = (stage: StageDetail) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
  };

  const cancelEdit = () => setEditingStageId(null);

  const saveEdit = async (stageId: string) => {
    if (savingRef.current) return;
    const trimmed = editStageName.trim();
    if (!trimmed) { cancelEdit(); return; }
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
      {concert.stages.map((stage, stageIdx) => (
        <section key={stage.id}>
          <div className="flex items-center gap-2 mb-3">
            {editingStageId === stage.id ? (
              <input
                value={editStageName}
                onChange={(e) => setEditStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(stage.id);
                  if (e.key === "Escape") cancelEdit();
                }}
                className="text-sm font-semibold text-gray-700 border-b border-brand-400 focus:outline-none bg-transparent flex-1 min-w-0 py-0.5"
                autoFocus
              />
            ) : (
              <h3 className="text-sm font-semibold text-gray-700 shrink-0">{stage.name}</h3>
            )}
            <div className="flex-1 h-px bg-gray-200" />
            {isAdmin && editingStageId === stage.id && (
              <div className="flex items-center gap-1 shrink-0">
                {savingStageId === stage.id
                  ? <Loader2 size={13} className="animate-spin text-brand-400" />
                  : (
                    <>
                      <button onClick={() => saveEdit(stage.id)} aria-label="保存" className="p-1 text-green-600 hover:text-green-700 transition-colors rounded">
                        <Check size={13} />
                      </button>
                      <button onClick={cancelEdit} aria-label="キャンセル" className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded">
                        <X size={13} />
                      </button>
                    </>
                  )
                }
              </div>
            )}
            {isAdmin && editingStageId !== stage.id && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => startEdit(stage)}
                  className="p-1 text-gray-400 hover:text-brand-500 transition-colors rounded"
                  title="名前を編集"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => onMoveStage(stage.id, -1)}
                  disabled={stageIdx === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25 transition-colors rounded"
                  title="上へ"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => onMoveStage(stage.id, 1)}
                  disabled={stageIdx === concert.stages.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25 transition-colors rounded"
                  title="下へ"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {stage.programs.map((program, progIdx) => (
              <div
                key={program.id}
                className={`flex items-center gap-3 px-5 py-4 ${progIdx < stage.programs.length - 1 || isAdmin ? "border-b border-gray-100" : ""}`}
              >
                <span className="text-sm text-gray-400 font-mono w-5 shrink-0">{progIdx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{program.title}</p>
                  {program.score && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[
                        program.score.composer ? `${program.score.composer} 作曲` : null,
                        program.score.arranger ? `${program.score.arranger} 編曲` : null,
                      ].filter(Boolean).join(" / ")}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onEditProgramClick(stage.id, program)}
                      className="p-1 text-gray-300 hover:text-brand-500 transition-colors rounded"
                      title="編集"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onMoveCopyClick(stage.id, program)}
                      className="p-1 text-gray-300 hover:text-brand-500 transition-colors rounded"
                      title="移動 / コピー"
                    >
                      <ArrowRightLeft size={13} />
                    </button>
                    <div className="flex flex-col">
                      <button
                        onClick={() => onMoveProgram(stage.id, program.id, -1)}
                        disabled={progIdx === 0}
                        className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-25 transition-colors"
                        title="上へ"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => onMoveProgram(stage.id, program.id, 1)}
                        disabled={progIdx === stage.programs.length - 1}
                        className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-25 transition-colors"
                        title="下へ"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isAdmin && (
              <button
                onClick={() => onAddClick(stage.id)}
                className="w-full flex items-center gap-2 px-5 py-3 text-xs text-gray-400 hover:text-brand-500 hover:bg-brand-50 transition-colors"
              >
                <Plus size={12} />
                曲目を追加
              </button>
            )}
          </div>
        </section>
      ))}

      {concert.stages.length === 0 && !isAdmin && (
        <p className="text-sm text-gray-400 text-center py-8">ステージ・演目が登録されていません</p>
      )}

      {isAdmin && (
        <button
          onClick={onAddStage}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs text-gray-400 hover:text-brand-500 border border-dashed border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors"
        >
          <Plus size={12} />
          ステージを追加
        </button>
      )}
    </div>
  );
}
