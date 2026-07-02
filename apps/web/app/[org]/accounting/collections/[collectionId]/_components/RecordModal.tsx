"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { accountingApi, PAYMENT_METHOD_LABEL } from "@/lib/accounting-api";
import type { CollectionPaymentItem, CollectionPaymentStatus, PaymentMethod } from "@/lib/accounting-api";

export const STATUS_STYLE: Record<CollectionPaymentStatus, string> = {
  paid:    "bg-teal-50 text-teal-700 border-teal-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  waived:  "bg-gray-100 text-gray-500 border-gray-200",
};

export const STATUS_LABEL: Record<CollectionPaymentStatus, string> = {
  paid:    "支払済",
  pending: "未払い",
  waived:  "免除",
};

export function StatusBadge({ status }: { status: CollectionPaymentStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[status]}`}>
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

export function RecordModal({ payment, defaultAmount, org, collectionId, onClose, onSaved }: RecordModalProps) {
  const [status, setStatus] = useState<CollectionPaymentStatus>(payment.status);
  const [amount, setAmount] = useState(
    String(payment.amount ?? payment.member.memberTypeFee ?? defaultAmount)
  );
  const [paidAt, setPaidAt] = useState(
    payment.paidAt ? payment.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [method,  setMethod]  = useState<PaymentMethod | "">(payment.method ?? "cash");
  const [note,    setNote]    = useState(payment.note ?? "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await accountingApi.recordPayment(org, collectionId, payment.member.id, {
        status,
        amount: status === "paid" ? (parseInt(amount, 10) || defaultAmount) : null,
        paidAt: status === "paid" && paidAt ? new Date(paidAt).toISOString() : null,
        method: status === "paid" ? ((method || null) as PaymentMethod | null) : null,
        note:   note.trim() || null,
      });
      onSaved(updated);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">支払い記録</h2>
            <p className="text-xs text-gray-400 mt-0.5">{payment.member.nameJa}</p>
          </div>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">ステータス</label>
            <div className="flex gap-2">
              {(["paid", "pending", "waived"] as CollectionPaymentStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={[
                    "flex-1 py-2 text-xs font-medium rounded-lg border transition-colors",
                    status === s ? STATUS_STYLE[s] : "border-gray-200 text-gray-400 hover:bg-gray-50",
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
                <label className="block text-xs font-medium text-gray-500 mb-1.5">金額（円）</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">支払日</label>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">方法</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    <option value="">—</option>
                    {(["cash", "paypay", "bank_transfer", "other"] as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">メモ</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="任意"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
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
