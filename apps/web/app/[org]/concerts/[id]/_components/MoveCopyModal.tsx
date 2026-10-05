"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { concertsApi, type ConcertStructure, type ProgramDetail } from "@/lib/concerts-api";
import { userErrorMessage } from "@/lib/api-client";

export type MoveCopyTarget =
  { type: "unassigned" } | { type: "stage"; concertId: string; stageId: string };

interface MoveCopyModalProps {
  orgSlug: string;
  concertId: string;
  stageId: string;
  program: ProgramDetail;
  onClose: () => void;
  onComplete: (
    action: "move" | "copy",
    target: MoveCopyTarget,
    newProgram?: ProgramDetail,
    warning?: string,
  ) => void;
}

export function MoveCopyModal({
  orgSlug,
  concertId,
  stageId,
  program,
  onClose,
  onComplete,
}: MoveCopyModalProps) {
  const [structure, setStructure] = useState<ConcertStructure[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [targetValue, setTargetValue] = useState<string>("unassigned");
  const [action, setAction] = useState<"move" | "copy">("move");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUnassigned = targetValue === "unassigned";

  useEffect(() => {
    concertsApi
      .getStructure(orgSlug)
      .then(setStructure)
      .catch((err: unknown) =>
        setLoadError(
          userErrorMessage(
            err,
            "移動先の読み込みに失敗しました。閉じてからもう一度開いてください。",
          ),
        ),
      )
      .finally(() => setLoadingStructure(false));
  }, [orgSlug]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

      const target: MoveCopyTarget = {
        type: "stage",
        concertId: targetConcertId,
        stageId: targetStageId,
      };

      if (action === "move") {
        try {
          await concertsApi.deleteProgram(orgSlug, concertId, program.id);
        } catch {
          onComplete(
            "copy",
            target,
            newProgram,
            "移動先に追加しましたが、元の曲目を削除できませんでした。元のステージに残った曲目は「移動 / コピー」で演奏会未定を選ぶと削除できます。",
          );
          return;
        }
      }

      onComplete(action, target, newProgram);
    } catch (err) {
      setError(userErrorMessage(err, "操作に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="移動 / コピー"
      description={`「${program.title}」の移動先 / コピー先を選択してください。`}
      size="sm"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving || loadingStructure || !!loadError}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isUnassigned ? "演奏会から削除" : action === "move" ? "移動する" : "コピーする"}
          </button>
        </>
      }
    >
      <div>
        <label
          htmlFor="move-copy-target"
          className="mb-1.5 block text-xs font-medium text-gray-600"
        >
          移動先 / コピー先
        </label>
        {loadError ? (
          <ErrorMessage variant="section">{loadError}</ErrorMessage>
        ) : loadingStructure ? (
          <div className="flex items-center gap-2 py-2 text-gray-400">
            <Loader2 size={13} className="animate-spin" />
            <span className="text-xs">読み込み中...</span>
          </div>
        ) : (
          <select
            id="move-copy-target"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            autoFocus
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
                    {stage.name}
                    {stage.id === stageId ? "（現在のステージ）" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {!isUnassigned && !loadError && (
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-gray-600">操作</legend>
          <div className="flex gap-3">
            {(
              [
                ["move", "移動"],
                ["copy", "コピー"],
              ] as const
            ).map(([val, label]) => (
              <label key={val} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="action"
                  value={val}
                  checked={action === val}
                  onChange={() => setAction(val)}
                  className="accent-brand-600"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {action === "move" ? "元の演奏会から削除されます" : "元の演奏会にも残ります"}
          </p>
        </fieldset>
      )}

      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
