"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export interface BatchFormValues {
  name: string;
  price: string;
  priceStudent: string;
  totalCount: string;
}

interface BatchFormModalProps {
  title: string;
  initialValues: BatchFormValues;
  submitLabel: string;
  onSubmit: (v: BatchFormValues) => Promise<void>;
  onClose: () => void;
  extraFooter?: React.ReactNode;
}

export function BatchFormModal({
  title,
  initialValues,
  submitLabel,
  onSubmit,
  onClose,
  extraFooter,
}: BatchFormModalProps) {
  const [form, setForm] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
    } catch {
      setError("操作に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-gray-800">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">席種名</label>
            <input
              type="text"
              required
              placeholder="例: 一般"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">一般価格（円）</label>
              <input
                type="number"
                required
                min={0}
                placeholder="3000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                学生価格（円・任意）
              </label>
              <input
                type="number"
                min={0}
                placeholder="1000"
                value={form.priceStudent}
                onChange={(e) => setForm({ ...form, priceStudent: e.target.value })}
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">総枚数</label>
            <input
              type="number"
              required
              min={1}
              placeholder="200"
              value={form.totalCount}
              onChange={(e) => setForm({ ...form, totalCount: e.target.value })}
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !form.name || !form.price || !form.totalCount}
              className="bg-brand-600 hover:bg-brand-700 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {submitLabel}
            </button>
          </div>
          {extraFooter}
        </form>
      </div>
    </div>
  );
}
