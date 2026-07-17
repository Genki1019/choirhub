"use client";

import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { accountingApi, PAYMENT_METHOD_LABEL } from "@/lib/accounting-api";
import type {
  ExpenseCategory,
  ExpenseItem,
  ExpenseInput,
  PaymentMethod,
} from "@/lib/accounting-api";

interface ExpenseModalProps {
  org: string;
  categories: ExpenseCategory[];
  editing: ExpenseItem | null;
  onClose: () => void;
  onSaved: (item: ExpenseItem, isNew: boolean) => void;
}

export function ExpenseModal({ org, categories, editing, onClose, onSaved }: ExpenseModalProps) {
  const [categoryId, setCategoryId] = useState(editing?.category.id ?? categories[0]?.id ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [method, setMethod] = useState<PaymentMethod | "">(editing?.paymentMethod ?? "");
  const [paidAt, setPaidAt] = useState(editing?.paidAt ? editing.paidAt.slice(0, 10) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("金額を正の整数で入力してください");
      return;
    }
    if (!categoryId) {
      setError("カテゴリを選択してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: ExpenseInput = {
        categoryId,
        title: title.trim(),
        amount: parsedAmount,
        paymentMethod: (method || null) as PaymentMethod | null,
        paidAt: paidAt ? new Date(paidAt).toISOString() : null,
        note: note.trim() || null,
      };
      if (editing) {
        const updated = await accountingApi.updateExpense(org, editing.id, data);
        onSaved(updated, false);
      } else {
        const created = await accountingApi.createExpense(org, data);
        onSaved(created, true);
      }
    } catch {
      setError("保存に失敗しました");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-800">{editing ? "支出を編集" : "支出を追加"}</h2>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label
              htmlFor="expense-category"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              カテゴリ
            </label>
            <select
              id="expense-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="expense-title"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              件名
            </label>
            <input
              id="expense-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="例: 市民会館 第2練習室 6/14"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="expense-amount"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              金額（円）
            </label>
            <input
              id="expense-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min={1}
              placeholder="8000"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="expense-method"
                className="mb-1.5 block text-xs font-medium text-gray-500"
              >
                支払方法
              </label>
              <select
                id="expense-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              >
                <option value="">—</option>
                {(["cash", "paypay", "bank_transfer", "other"] as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="expense-paidAt"
                className="mb-1.5 block text-xs font-medium text-gray-500"
              >
                支払日
              </label>
              <input
                id="expense-paidAt"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="expense-note"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              メモ
            </label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="任意"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {editing ? "更新する" : "追加する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
