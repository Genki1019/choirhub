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
  const [amount,  setAmount]  = useState(initialAmount);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

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
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">会費の徴収方法</h2>
        <p className="text-xs text-gray-400">練習イベント作成時に自動で徴収レコードを生成する場合は「練習ごと」を選択してください。</p>
      </div>

      <div className="space-y-2">
        {(["per_rehearsal", "monthly"] as const).map((type) => (
          <label
            key={type}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
              feeType === type ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:bg-gray-50",
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
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          {feeType === "per_rehearsal" ? "1回あたりの場所代（円）" : "月額会費（円）"}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            placeholder="例: 300"
            className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <span className="text-sm text-gray-400">円</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">空欄にすると自動生成は行われません。</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-teal-600">
            <CheckCircle size={12} />
            保存しました
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          保存する
        </button>
      </div>
    </form>
  );
}
