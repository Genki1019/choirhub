"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Check, AlertTriangle } from "lucide-react";
import {
  scoresApi,
  type ScoreSummary,
  type ScoreDetail,
  type ScoreMetaResponse,
  type UpdateScoreMetaInput,
  type ConcertWithScores,
} from "@/lib/scores-api";
import { concertsApi } from "@/lib/concerts-api";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";
const SELECT_CLS = `${INPUT_CLS} bg-white`;
const FORM_ID = "score-form";

type ExistingScore = { title: string; composer: string | null };

export type ScoreFormModalProps =
  | {
      mode: "add";
      orgSlug: string;
      existingScores: ExistingScore[];
      concerts: ConcertWithScores[];
      onClose: () => void;
      onCreated: (score: ScoreSummary, stageAssigned: boolean) => void;
    }
  | {
      mode: "edit";
      orgSlug: string;
      score: ScoreDetail;
      isAdmin: boolean;
      onClose: () => void;
      onSaved: (updated: ScoreMetaResponse) => void;
    };

function hasDuplicate(existing: ExistingScore[], title: string, composer: string): boolean {
  const t = title.trim().toLowerCase();
  const c = composer.trim().toLowerCase() || null;
  return existing.some(
    (s) => s.title.trim().toLowerCase() === t && (s.composer?.trim().toLowerCase() ?? null) === c,
  );
}

export function ScoreFormModal(props: ScoreFormModalProps) {
  const { onClose } = props;
  const isAdd = props.mode === "add";
  const existingScore = props.mode === "edit" ? props.score : null;
  const canEditTitle = isAdd || (props.mode === "edit" && props.isAdmin);

  const [title, setTitle] = useState(existingScore?.title ?? "");
  const [composer, setComposer] = useState(existingScore?.composer ?? "");
  const [arranger, setArranger] = useState(existingScore?.arranger ?? "");
  const [isCommissioned, setIsCommissioned] = useState(existingScore?.isCommissioned ?? false);
  const [purchaseDate, setPurchaseDate] = useState(existingScore?.purchaseDate ?? "");
  const [distributionStart, setDistributionStart] = useState(
    existingScore?.distributionStart ?? "",
  );
  const [purchasePrice, setPurchasePrice] = useState(
    existingScore?.purchasePrice != null ? String(existingScore.purchasePrice) : "",
  );
  const [notes, setNotes] = useState(existingScore?.notes ?? "");

  const [selectedConcertId, setSelectedConcertId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const concerts = props.mode === "add" ? props.concerts : [];
  const stages = concerts.find((c) => c.id === selectedConcertId)?.stages ?? [];

  const [prevConcertId, setPrevConcertId] = useState(selectedConcertId);
  if (selectedConcertId !== prevConcertId) {
    setPrevConcertId(selectedConcertId);
    setSelectedStageId(stages.length === 1 ? stages[0].id : "");
  }

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  const checkDuplicate = () => {
    if (props.mode !== "add") return;
    if (hasDuplicate(props.existingScores, title, composer)) setDuplicateWarning(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdd && !title.trim()) {
      setError("曲名を入力してください");
      return;
    }
    if (duplicateWarning) return;

    const trimmedPrice = purchasePrice.trim();
    const parsedPurchasePrice = trimmedPrice === "" ? null : parseInt(trimmedPrice, 10);
    if (parsedPurchasePrice !== null && (isNaN(parsedPurchasePrice) || parsedPurchasePrice < 0)) {
      setError("仕入価格は0以上の整数で入力してください");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (props.mode === "add") {
        const created = await scoresApi.create(props.orgSlug, {
          title: title.trim(),
          composer: composer.trim() || null,
          arranger: arranger.trim() || null,
          isCommissioned,
          purchaseDate: purchaseDate || null,
          distributionStart: distributionStart || null,
          purchasePrice: parsedPurchasePrice,
          notes: notes.trim() || null,
        });
        if (selectedConcertId && selectedStageId) {
          await concertsApi.addProgram(props.orgSlug, selectedConcertId, selectedStageId, {
            scoreId: created.id,
          });
          props.onCreated(created, true);
        } else {
          props.onCreated(created, false);
        }
      } else {
        const payload: UpdateScoreMetaInput = {
          isCommissioned,
          purchaseDate: purchaseDate.trim() || null,
          distributionStart: distributionStart.trim() || null,
          purchasePrice: parsedPurchasePrice,
          notes: notes.trim() || null,
        };
        if (props.isAdmin) {
          payload.title = title.trim() || props.score.title;
          payload.composer = composer.trim() || null;
          payload.arranger = arranger.trim() || null;
        }
        const updated = await scoresApi.updateMeta(props.orgSlug, props.score.id, payload);
        props.onSaved(updated);
      }
    } catch (err) {
      setError(
        isAdd ? (err instanceof Error ? err.message : "登録に失敗しました") : "保存に失敗しました",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitDisabled =
    saving ||
    duplicateWarning ||
    (isAdd && !!selectedConcertId && !selectedStageId && stages.length > 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">
            {isAdd ? "曲目を追加" : "楽譜情報を編集"}
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
        >
          {canEditTitle && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  曲名 <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDuplicateWarning(false);
                  }}
                  onBlur={checkDuplicate}
                  placeholder="例: 男声合唱のための「風と光」"
                  className={INPUT_CLS}
                  autoFocus={isAdd}
                  required={isAdd}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">作曲者</label>
                  <input
                    value={composer}
                    onChange={(e) => {
                      setComposer(e.target.value);
                      setDuplicateWarning(false);
                    }}
                    onBlur={checkDuplicate}
                    placeholder="例: 山田 花子"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">編曲者</label>
                  <input
                    value={arranger}
                    onChange={(e) => setArranger(e.target.value)}
                    placeholder="例: 田中 二郎"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <input
              id="score-form-commissioned"
              type="checkbox"
              checked={isCommissioned}
              onChange={(e) => setIsCommissioned(e.target.checked)}
              className="text-brand-600 focus:ring-brand-400 rounded border-gray-300"
            />
            <label htmlFor="score-form-commissioned" className="text-sm text-gray-700">
              委嘱作品
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">購入日</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">配布開始日</label>
              <input
                type="date"
                value={distributionStart}
                onChange={(e) => setDistributionStart(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">仕入価格（円）</label>
            <input
              type="number"
              min="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="例: 500"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {isAdd && concerts.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-1">
              <p className="pt-1 text-xs font-medium text-gray-500">ステージに追加（任意）</p>
              <select
                value={selectedConcertId}
                onChange={(e) => setSelectedConcertId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">演奏会未定</option>
                {concerts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {selectedConcertId && stages.length > 1 && (
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">ステージを選択</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {duplicateWarning && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle size={13} />
                同じ曲名・作曲者の楽譜が既に登録されています
              </div>
              <button
                type="button"
                onClick={() => setDuplicateWarning(false)}
                className="self-start text-amber-700 underline hover:text-amber-900"
              >
                それでも追加する
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}
        </form>

        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="submit"
            form={FORM_ID}
            disabled={submitDisabled}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isAdd ? (
              <Check size={14} />
            ) : null}
            {isAdd ? "追加する" : "保存"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
