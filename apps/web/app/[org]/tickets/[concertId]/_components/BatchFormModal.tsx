"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

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
  footerStart?: ReactNode;
}

const INPUT_CLS =
  "focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none";
const LABEL_CLS = "mb-1 block text-xs font-medium text-gray-500";

export function BatchFormModal({
  title,
  initialValues,
  submitLabel,
  onSubmit,
  onClose,
  footerStart,
}: BatchFormModalProps) {
  const [form, setForm] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(userErrorMessage(err, "席種の保存に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={saving}
      footer={
        <>
          {footerStart && <div className="mr-auto self-center">{footerStart}</div>}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving || !form.name || !form.price || !form.totalCount}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {submitLabel}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="batch-name" className={LABEL_CLS}>
          席種名
        </label>
        <input
          id="batch-name"
          type="text"
          required
          placeholder="例: 一般"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={INPUT_CLS}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="batch-price" className={LABEL_CLS}>
            一般価格（円）
          </label>
          <input
            id="batch-price"
            type="number"
            required
            min={0}
            placeholder="3000"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label htmlFor="batch-price-student" className={LABEL_CLS}>
            学生価格（円・任意）
          </label>
          <input
            id="batch-price-student"
            type="number"
            min={0}
            placeholder="1000"
            value={form.priceStudent}
            onChange={(e) => setForm({ ...form, priceStudent: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
      </div>
      <div>
        <label htmlFor="batch-total-count" className={LABEL_CLS}>
          総枚数
        </label>
        <input
          id="batch-total-count"
          type="number"
          required
          min={1}
          placeholder="200"
          value={form.totalCount}
          onChange={(e) => setForm({ ...form, totalCount: e.target.value })}
          className={INPUT_CLS}
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
