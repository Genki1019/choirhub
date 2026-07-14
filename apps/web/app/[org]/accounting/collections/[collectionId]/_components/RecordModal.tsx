"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { accountingApi, PAYMENT_METHOD_LABEL } from "@/lib/accounting-api";
import type {
  CollectionPaymentItem,
  CollectionPaymentStatus,
  PaymentMethod,
} from "@/lib/accounting-api";

export const STATUS_STYLE: Record<CollectionPaymentStatus, string> = {
  paid: "bg-teal-50 text-teal-700 border-teal-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  waived: "bg-gray-100 text-gray-500 border-gray-200",
};

export const STATUS_LABEL: Record<CollectionPaymentStatus, string> = {
  paid: "支払済",
  pending: "未払い",
  waived: "免除",
};

export function StatusBadge({ status }: { status: CollectionPaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

interface RecordModalProps {
  payment: CollectionPaymentItem;
  defaultAmount: number;
  org: string;
  collectionId: string;
  onClose: () => void;
  onSaved: (updated: CollectionPaymentItem) => void;
}

export function RecordModal({
  payment,
  defaultAmount,
  org,
  collectionId,
  onClose,
  onSaved,
}: RecordModalProps) {
  const [status, setStatus] = useState<CollectionPaymentStatus>(payment.status);
  const [amount, setAmount] = useState(
    String(payment.amount ?? payment.member.memberTypeFee ?? defaultAmount),
  );
  const [paidAt, setPaidAt] = useState(
    payment.paidAt ? payment.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [method, setMethod] = useState<PaymentMethod | "">(payment.method ?? "cash");
  const [note, setNote] = useState(payment.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await accountingApi.recordPayment(org, collectionId, payment.member.id, {
        status,
        amount: status === "paid" ? parseInt(amount, 10) || defaultAmount : null,
        paidAt: status === "paid" && paidAt ? new Date(paidAt).toISOString() : null,
        method: status === "paid" ? ((method || null) as PaymentMethod | null) : null,
        note: note.trim() || null,
      });
      onSaved(updated);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-800">支払い記録</h2>
            <p className="mt-0.5 text-xs text-gray-400">{payment.member.nameJa}</p>
          </div>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">ステータス</label>
            <div className="flex gap-2">
              {(["paid", "pending", "waived"] as CollectionPaymentStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={[
                    "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                    status === s
                      ? STATUS_STYLE[s]
                      : "border-gray-200 text-gray-400 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {status === "paid" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">金額（円）</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">支払日</label>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">方法</label>
                  <select
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
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">メモ</label>
            <input
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
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
