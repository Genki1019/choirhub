"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import {
  concertsApi,
  type ConcertDetail,
  type ConcertStatus,
  type UpdateConcertInput,
} from "@/lib/concerts-api";
import { LocationSearch } from "@/components/LocationSearch";
import { toDateString } from "@/lib/date";

interface EditConcertModalProps {
  concert: ConcertDetail;
  orgSlug: string;
  onClose: () => void;
  onSaved: (updated: Partial<ConcertDetail>) => void;
}

export function EditConcertModal({ concert, orgSlug, onClose, onSaved }: EditConcertModalProps) {
  const STATUS_OPTIONS: { value: ConcertStatus; label: string }[] = [
    { value: "draft", label: "準備中" },
    { value: "confirmed", label: "確定済み" },
    { value: "past", label: "終了" },
  ];

  const [form, setForm] = useState<UpdateConcertInput>({
    title: concert.title,
    heldOn: toDateString(concert.heldOn),
    venue: concert.venue ?? "",
    status: concert.status,
  });
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
    if (!form.title?.trim()) {
      setError("演奏会名を入力してください");
      return;
    }
    if (!form.heldOn) {
      setError("日付を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await concertsApi.update(orgSlug, concert.id, {
        ...form,
        venue: form.venue?.trim() || null,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">演奏会情報を編集</h2>
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
              演奏会名 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              開催日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.heldOn ?? ""}
              onChange={(e) => setForm({ ...form, heldOn: e.target.value })}
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div className="relative z-10">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">会場</label>
            <LocationSearch
              value={form.venue ?? ""}
              placeholder="例: ○○ホール 大ホール"
              onChangeName={(name) => setForm({ ...form, venue: name })}
              onSelectPlace={(name) => setForm({ ...form, venue: name })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">ステータス</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ConcertStatus })}
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
