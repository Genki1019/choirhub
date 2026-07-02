"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import { concertsApi, type ConcertDetail, type ConcertStatus, type UpdateConcertInput } from "@/lib/concerts-api";
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
    { value: "draft",     label: "準備中" },
    { value: "confirmed", label: "確定済み" },
    { value: "past",      label: "終了" },
  ];

  const [form, setForm] = useState<UpdateConcertInput>({
    title:       concert.title,
    heldOn: toDateString(concert.heldOn),
    venue:       concert.venue ?? "",
    status:      concert.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!form.title?.trim()) { setError("演奏会名を入力してください"); return; }
    if (!form.heldOn)   { setError("日付を入力してください"); return; }
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">演奏会情報を編集</h2>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              演奏会名 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              開催日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.heldOn ?? ""}
              onChange={(e) => setForm({ ...form, heldOn: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="relative z-10">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">会場</label>
            <LocationSearch
              value={form.venue ?? ""}
              placeholder="例: ○○ホール 大ホール"
              onChangeName={(name) => setForm({ ...form, venue: name })}
              onSelectPlace={(name) => setForm({ ...form, venue: name })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">ステータス</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ConcertStatus })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
