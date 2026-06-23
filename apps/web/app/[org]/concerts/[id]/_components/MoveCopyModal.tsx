"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import { concertsApi, type ConcertStructure, type ProgramDetail } from "@/lib/concerts-api";

export type MoveCopyTarget =
  | { type: "unassigned" }
  | { type: "stage"; concertId: string; stageId: string };

interface MoveCopyModalProps {
  orgSlug: string;
  concertId: string;
  stageId: string;
  program: ProgramDetail;
  onClose: () => void;
  onComplete: (action: "move" | "copy", target: MoveCopyTarget, newProgram?: ProgramDetail) => void;
}

export function MoveCopyModal({ orgSlug, concertId, stageId, program, onClose, onComplete }: MoveCopyModalProps) {
  const [structure, setStructure] = useState<ConcertStructure[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [targetValue, setTargetValue] = useState<string>("unassigned");
  const [action, setAction] = useState<"move" | "copy">("move");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUnassigned = targetValue === "unassigned";

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    concertsApi.getStructure(orgSlug)
      .then(setStructure)
      .catch(() => {})
      .finally(() => setLoadingStructure(false));
  }, [orgSlug]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isUnassigned) {
        await concertsApi.deleteProgram(orgSlug, concertId, program.id);
        onComplete("move", { type: "unassigned" });
        return;
      }

      const [targetConcertId, targetStageId] = targetValue.split("::");
      if (!targetConcertId || !targetStageId) return;

      const newProgram = await concertsApi.addProgram(orgSlug, targetConcertId, targetStageId, {
        scoreId: program.score?.id,
        title: program.title,
      });

      if (action === "move") {
        await concertsApi.deleteProgram(orgSlug, concertId, program.id);
      }

      onComplete(action, { type: "stage", concertId: targetConcertId, stageId: targetStageId }, newProgram);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">移動 / コピー</h2>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{program.title}</span> の移動先 / コピー先を選択してください。
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">移動先 / コピー先</label>
            {loadingStructure ? (
              <div className="flex items-center gap-2 py-2 text-gray-400">
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs">読み込み中...</span>
              </div>
            ) : (
              <select
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="unassigned">演奏会未定（この演奏会から削除）</option>
                {structure.map((concert) => (
                  <optgroup key={concert.id} label={concert.title}>
                    {concert.stages.map((stage) => (
                      <option
                        key={stage.id}
                        value={`${concert.id}::${stage.id}`}
                        disabled={stage.id === stageId}
                      >
                        {stage.name}{stage.id === stageId ? "（現在のステージ）" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {!isUnassigned && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">操作</label>
              <div className="flex gap-3">
                {([["move", "移動"], ["copy", "コピー"]] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      value={val}
                      checked={action === val}
                      onChange={() => setAction(val)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {action === "move" ? "元の演奏会から削除されます" : "元の演奏会にも残ります"}
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isUnassigned ? "演奏会から削除" : action === "move" ? "移動する" : "コピーする"}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
