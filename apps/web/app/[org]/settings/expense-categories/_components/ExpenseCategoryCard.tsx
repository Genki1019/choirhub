"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { ExpenseCategory } from "@/lib/accounting-api";

interface ExpenseCategoryCardProps {
  cats: ExpenseCategory[];
  org: string;
  onUpdated: (updated: ExpenseCategory) => void;
  onDeleted: (id: string) => void;
  onCreated: (created: ExpenseCategory) => void;
  onToast: (msg: string) => void;
}

export function ExpenseCategoryCard({
  cats, org, onUpdated, onDeleted, onCreated, onToast,
}: ExpenseCategoryCardProps) {
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [busy,     setBusy]     = useState(false);

  const confirmEdit = async () => {
    if (!editName.trim() || !editId) return;
    setBusy(true);
    try {
      const updated = await settingsApi.updateExpenseCategory(org, editId, { name: editName.trim() });
      onUpdated(updated);
      setEditId(null);
    } catch {
      onToast("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (cat: ExpenseCategory) => {
    setBusy(true);
    try {
      await settingsApi.deleteExpenseCategory(org, cat.id);
      onDeleted(cat.id);
    } catch (err) {
      onToast(
        err instanceof ApiClientError && err.status === 409
          ? "支出記録が紐付いているため削除できません"
          : "削除に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const created = await settingsApi.createExpenseCategory(org, { name: newName.trim() });
      onCreated(created);
      setNewName("");
      setShowAdd(false);
    } catch {
      onToast("追加に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">支出カテゴリ</p>
        <button
          onClick={() => { setShowAdd(true); setEditId(null); }}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-40"
        >
          <Plus size={13} />
          追加
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {cats.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
            {editId === cat.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit();
                    if (e.key === "Escape") setEditId(null);
                  }}
                  className="flex-1 border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <button onClick={confirmEdit} disabled={busy} aria-label="保存" className="text-teal-600 hover:text-teal-700 disabled:opacity-40">
                  <Check size={15} />
                </button>
                <button onClick={() => setEditId(null)} aria-label="キャンセル" className="text-gray-400 hover:text-gray-600">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => { setEditId(cat.id); setEditName(cat.name); }}
                    disabled={busy}
                    className="p-1.5 text-gray-300 hover:text-brand-500 transition-colors disabled:opacity-40"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteCategory(cat)}
                    disabled={busy}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {cats.length === 0 && !showAdd && (
          <p className="px-5 py-4 text-sm text-gray-400">カテゴリがまだありません</p>
        )}
      </div>

      {showAdd && (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-brand-100 bg-brand-50/40">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCategory();
              if (e.key === "Escape") { setShowAdd(false); setNewName(""); }
            }}
            placeholder="カテゴリ名を入力"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white placeholder-gray-300"
          />
          <button
            onClick={addCategory}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : "追加"}
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewName(""); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
