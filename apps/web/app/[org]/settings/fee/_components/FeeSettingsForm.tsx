"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";

interface FeeSettingsFormProps {
  orgSlug: string;
  initialFeeType: "per_rehearsal" | "monthly";
  initialAmount: string;
}

export function FeeSettingsForm({ orgSlug, initialFeeType, initialAmount }: FeeSettingsFormProps) {
  const [feeType, setFeeType] = useState(initialFeeType);
  const [amount, setAmount] = useState(initialAmount);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const parsedAmount = amount.trim() === "" ? null : parseInt(amount, 10);
      if (amount.trim() !== "" && isNaN(parsedAmount!)) {
        setError("金額は数値で入力してください");
        return;
      }
      await settingsApi.updateFee(orgSlug, { feeType, defaultFeeAmount: parsedAmount });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="space-y-5 rounded-xl border border-gray-200 bg-white px-6 py-5"
    >
      <div>
        <h2 className="mb-1 text-sm font-semibold text-gray-700">会費の徴収方法</h2>
        <p className="text-xs text-gray-400">
          練習イベント作成時に自動で徴収レコードを生成する場合は「練習ごと」を選択してください。
        </p>
      </div>

      <div className="space-y-2">
        {(["per_rehearsal", "monthly"] as const).map((type) => (
          <label
            key={type}
            className={[
              "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
              feeType === type
                ? "border-brand-400 bg-brand-50"
                : "border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            <input
              type="radio"
              name="feeType"
              value={type}
              checked={feeType === type}
              onChange={() => setFeeType(type)}
              className="accent-brand-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {type === "per_rehearsal" ? "練習ごとの場所代" : "月額制"}
              </p>
              <p className="text-xs text-gray-400">
                {type === "per_rehearsal"
                  ? "練習イベント作成時に場所代の徴収レコードを自動生成します"
                  : "毎月の月初に手動で徴収を作成します"}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500">
          {feeType === "per_rehearsal" ? "1回あたりの場所代（円）" : "月額会費（円）"}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            placeholder="例: 300"
            className="focus:ring-brand-400 w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
          />
          <span className="text-sm text-gray-400">円</span>
        </div>
        <p className="mt-1 text-xs text-gray-400">空欄にすると自動生成は行われません。</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-2">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-teal-600">
            <CheckCircle size={12} />
            保存しました
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          保存する
        </button>
      </div>
    </form>
  );
}
