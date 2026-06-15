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

export function AddStageModal({ orgSlug, concertId, stageCount, onClose, onCreated }: AddStageModalProps) {
  const [form, setForm] = useState<AddStageInput>({ name: `第${stageCount + 1}ステージ` });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("ステージ名を入力してください"); return; }
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">ステージを追加</h2>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              ステージ名 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="例: 第1ステージ（委嘱作品）"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>
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
            追加する
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
