"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
import { accountingApi } from "@/lib/accounting-api";
import type { MemberType } from "@/lib/settings-api";

type Mode = "flat" | "per_type";

interface CollectionModalProps {
  org: string;
  memberTypes: MemberType[] | undefined;
  initialTitle?: string;
  initialAmount?: number;
  scoreId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CollectionModal({
  org,
  memberTypes: loadedMemberTypes,
  initialTitle,
  initialAmount,
  scoreId,
  onClose,
  onSaved,
}: CollectionModalProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [yearMonth, setYearMonth] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<Mode>("flat");
  const [baseAmount, setBaseAmount] = useState(initialAmount != null ? String(initialAmount) : "");
  const memberTypes = loadedMemberTypes ?? [];
  const perTypeUnavailableReason =
    loadedMemberTypes === undefined
      ? "メンバー区分を読み込めていないため、区分ごとには指定できません"
      : loadedMemberTypes.length === 0
        ? "メンバー区分が登録されていないため、区分ごとには指定できません"
        : null;
  const [typeAmounts, setTypeAmounts] = useState<Record<string, string>>({});
  const typeAmountOf = (t: MemberType) => typeAmounts[t.id] ?? t.defaultFeeAmount?.toString() ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const parsedBase = parseInt(baseAmount, 10);
    if (isNaN(parsedBase) || parsedBase <= 0) {
      setError(
        mode === "flat"
          ? "金額を正の整数で入力してください"
          : "区分未設定の金額を正の整数で入力してください",
      );
      return;
    }

    let memberTypeAmounts: Record<string, number> | undefined;

    if (mode === "per_type" && memberTypes.length > 0) {
      memberTypeAmounts = {};
      for (const t of memberTypes) {
        const val = parseInt(typeAmountOf(t), 10);
        if (isNaN(val) || val <= 0) {
          setError(`「${t.name}」の金額を正の整数で入力してください`);
          return;
        }
        memberTypeAmounts[t.id] = val;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await accountingApi.createCollection(org, {
        title: title.trim(),
        amount: parsedBase,
        yearMonth: yearMonth || null,
        note: note.trim() || null,
        scoreId: scoreId ?? null,
        memberTypeAmounts,
      });
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, "徴収の作成に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="徴収を作成"
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
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            作成する
          </button>
        </>
      }
    >
      <div>
        <label
          htmlFor="collection-title"
          className="mb-1.5 block text-xs font-medium text-gray-500"
        >
          件名
        </label>
        <input
          id="collection-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="例: 7月合宿費"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-gray-500">金額設定</legend>
        <div className="mb-3 flex gap-5">
          {(
            [
              ["flat", "全員共通"],
              ["per_type", "区分ごとに指定"],
            ] as [Mode, string][]
          ).map(([m, label]) => {
            const unavailable = m === "per_type" && perTypeUnavailableReason !== null;
            return (
              <label
                key={m}
                className={`flex items-center gap-1.5 ${unavailable ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={mode === m}
                  disabled={unavailable}
                  aria-describedby={unavailable ? "collection-per-type-note" : undefined}
                  onChange={() => setMode(m)}
                  className="text-brand-600 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            );
          })}
        </div>
        {perTypeUnavailableReason && (
          <p id="collection-per-type-note" className="-mt-2 mb-3 text-xs text-gray-400">
            {perTypeUnavailableReason}
          </p>
        )}

        {mode === "flat" ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              aria-label="金額（円）"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              required
              min={1}
              placeholder="3000"
              className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
            <span className="shrink-0 text-xs text-gray-400">円</span>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
            {memberTypes.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm text-gray-700">{t.name}</span>
                <input
                  type="number"
                  value={typeAmountOf(t)}
                  onChange={(e) => setTypeAmounts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  required
                  min={1}
                  placeholder="3000"
                  aria-label={`${t.name}の金額`}
                  className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
                <span className="shrink-0 text-xs text-gray-400">円</span>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-gray-200 pt-2">
              <span className="w-28 shrink-0 text-sm text-gray-400">区分未設定</span>
              <input
                type="number"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                required
                min={1}
                placeholder="3000"
                aria-label="区分未設定の金額"
                className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
              />
              <span className="shrink-0 text-xs text-gray-400">円</span>
            </div>
          </div>
        )}
      </fieldset>

      <div>
        <label
          htmlFor="collection-yearMonth"
          className="mb-1.5 block text-xs font-medium text-gray-500"
        >
          対象年月（任意）
        </label>
        <input
          id="collection-yearMonth"
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="collection-note" className="mb-1.5 block text-xs font-medium text-gray-500">
          メモ
        </label>
        <input
          id="collection-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="任意"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <p className="text-xs text-gray-400">
        作成後、アクティブな全団員（体験除く）に支払い待ちレコードが自動生成されます。
      </p>

      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
