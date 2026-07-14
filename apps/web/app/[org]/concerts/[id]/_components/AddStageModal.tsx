"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import { concertsApi, type AddStageInput, type StageDetail } from "@/lib/concerts-api";

interface AddStageModalProps {
  orgSlug: string;
  concertId: string;
  stageCount: number;
  onClose: () => void;
  onCreated: (stage: StageDetail) => void;
}

export function AddStageModal({
  orgSlug,
  concertId,
  stageCount,
  onClose,
  onCreated,
}: AddStageModalProps) {
  const [form, setForm] = useState<AddStageInput>({ name: `第${stageCount + 1}ステージ` });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("ステージ名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await concertsApi.addStage(orgSlug, concertId, form);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">ステージを追加</h2>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              ステージ名 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="例: 第1ステージ（委嘱作品）"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            追加する
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
