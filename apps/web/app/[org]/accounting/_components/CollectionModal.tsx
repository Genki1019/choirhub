"use client";

import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { accountingApi } from "@/lib/accounting-api";
import type { MemberType } from "@/lib/settings-api";

type Mode = "flat" | "per_type";

interface CollectionModalProps {
  org: string;
  memberTypes: MemberType[];
  initialTitle?: string;
  initialAmount?: number;
  scoreId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CollectionModal({ org, memberTypes, initialTitle, initialAmount, scoreId, onClose, onSaved }: CollectionModalProps) {
  const [title,      setTitle]      = useState(initialTitle ?? "");
  const [yearMonth,  setYearMonth]  = useState("");
  const [note,       setNote]       = useState("");
  const [mode,       setMode]       = useState<Mode>("flat");
  const [baseAmount, setBaseAmount] = useState(initialAmount != null ? String(initialAmount) : "");
  const [typeAmounts, setTypeAmounts] = useState<Record<string, string>>(
    () => Object.fromEntries(memberTypes.map((t) => [t.id, t.defaultFeeAmount?.toString() ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const parsedBase = parseInt(baseAmount, 10);
    if (isNaN(parsedBase) || parsedBase <= 0) {
      setError(mode === "flat" ? "金額を正の整数で入力してください" : "区分未設定の金額を正の整数で入力してください");
      return;
    }

    let memberTypeAmounts: Record<string, number> | undefined;

    if (mode === "per_type" && memberTypes.length > 0) {
      memberTypeAmounts = {};
      for (const t of memberTypes) {
        const val = parseInt(typeAmounts[t.id] ?? "", 10);
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
        title:     title.trim(),
        amount:    parsedBase,
        yearMonth: yearMonth || null,
        note:      note.trim() || null,
        scoreId:   scoreId ?? null,
        memberTypeAmounts,
      });
      onSaved();
    } catch {
      setError("作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">徴収を作成</h2>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">件名</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="例: 7月合宿費"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">金額設定</p>
            <div className="flex gap-5 mb-3">
              {([["flat", "全員共通"], ["per_type", "区分ごとに指定"]] as [Mode, string][]).map(([m, label]) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="w-3.5 h-3.5 text-brand-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>

            {mode === "flat" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  required
                  min={1}
                  placeholder="3000"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <span className="text-xs text-gray-400 shrink-0">円</span>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-gray-100 px-3 py-3 bg-gray-50">
                {memberTypes.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-28 shrink-0 truncate">{t.name}</span>
                    <input
                      type="number"
                      value={typeAmounts[t.id] ?? ""}
                      onChange={(e) => setTypeAmounts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      required
                      min={1}
                      placeholder="3000"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <span className="text-xs text-gray-400 shrink-0">円</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-400 w-28 shrink-0">区分未設定</span>
                  <input
                    type="number"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    required
                    min={1}
                    placeholder="3000"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <span className="text-xs text-gray-400 shrink-0">円</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">対象年月（任意）</label>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">メモ</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="任意"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          <p className="text-xs text-gray-400">
            作成後、アクティブな全団員（体験除く）に支払い待ちレコードが自動生成されます。
          </p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              作成する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
