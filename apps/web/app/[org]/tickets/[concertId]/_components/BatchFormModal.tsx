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
  title, initialValues, submitLabel, onSubmit, onClose, extraFooter,
}: BatchFormModalProps) {
  const [form,   setForm]   = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">席種名</label>
            <input
              type="text"
              required
              placeholder="例: 一般"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">一般価格（円）</label>
              <input
                type="number"
                required
                min={0}
                placeholder="3000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">学生価格（円・任意）</label>
              <input
                type="number"
                min={0}
                placeholder="1000"
                value={form.priceStudent}
                onChange={(e) => setForm({ ...form, priceStudent: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">総枚数</label>
            <input
              type="number"
              required
              min={1}
              placeholder="200"
              value={form.totalCount}
              onChange={(e) => setForm({ ...form, totalCount: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !form.name || !form.price || !form.totalCount}
              className="flex-1 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
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
