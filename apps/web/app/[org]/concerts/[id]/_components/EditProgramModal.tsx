"use client";

import { concertsApi, type ProgramDetail } from "@/lib/concerts-api";
import { Check, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";

interface EditProgramModalProps {
  orgSlug: string;
  concertId: string;
  program: ProgramDetail;
  onClose: () => void;
  onSaved: (updated: ProgramDetail) => void;
}

export function EditProgramModal({ orgSlug, concertId, program, onClose, onSaved }: EditProgramModalProps) {
  const [title, setTitle] = useState(program.title);
  const [composer, setComposer] = useState(program.score?.composer ?? "");
  const [arranger, setArranger] = useState(program.score?.arranger ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("曲名を入力してください"); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await concertsApi.updateProgram(orgSlug, concertId, program.id, {
        title:    title.trim(),
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">曲目を編集</h2>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              曲名 <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLS}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">作曲者</label>
              <input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="例: 山田 花子"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">編曲者</label>
              <input
                value={arranger}
                onChange={(e) => setArranger(e.target.value)}
                placeholder="例: 田中 二郎"
                className={INPUT_CLS}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            保存する
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
