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

export function EditProgramModal({
  orgSlug,
  concertId,
  program,
  onClose,
  onSaved,
}: EditProgramModalProps) {
  const [title, setTitle] = useState(program.title);
  const [composer, setComposer] = useState(program.score?.composer ?? "");
  const [arranger, setArranger] = useState(program.score?.arranger ?? "");
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
    if (!title.trim()) {
      setError("曲名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await concertsApi.updateProgram(orgSlug, concertId, program.id, {
        title: title.trim(),
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

  const INPUT_CLS =
    "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">曲目を編集</h2>
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
              <label className="mb-1.5 block text-xs font-medium text-gray-600">作曲者</label>
              <input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="例: 山田 花子"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">編曲者</label>
              <input
                value={arranger}
                onChange={(e) => setArranger(e.target.value)}
                placeholder="例: 田中 二郎"
                className={INPUT_CLS}
              />
            </div>
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
            保存する
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
