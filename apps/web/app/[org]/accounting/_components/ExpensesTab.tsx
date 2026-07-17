"use client";

import { Wallet, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { PAYMENT_METHOD_LABEL } from "@/lib/accounting-api";
import type { ExpenseItem } from "@/lib/accounting-api";

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

interface ExpensesTabProps {
  expenses: ExpenseItem[];
  deletingId: string | null;
  onAddClick: () => void;
  onEditClick: (expense: ExpenseItem) => void;
  onDeleteClick: (id: string) => void;
}

export function ExpensesTab({
  expenses,
  deletingId,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: ExpensesTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onAddClick}
          className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          <Plus size={14} />
          支出を追加
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Wallet size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">支出が登録されていません</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="divide-y divide-gray-100">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {exp.category.name}
                    </span>
                    {exp.paymentMethod && (
                      <span className="text-xs text-gray-400">
                        {PAYMENT_METHOD_LABEL[exp.paymentMethod]}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-gray-800">{exp.title}</p>
                  <p className="text-xs text-gray-400">{fmtDate(exp.paidAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-red-600">{yen(exp.amount)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => onEditClick(exp)}
                    aria-label={`${exp.title}を編集`}
                    className="hover:text-brand-500 p-1.5 text-gray-300 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDeleteClick(exp.id)}
                    disabled={deletingId === exp.id}
                    aria-label={`${exp.title}を削除`}
                    className="p-1.5 text-gray-300 transition-colors hover:text-red-500 disabled:opacity-40"
                  >
                    {deletingId === exp.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
