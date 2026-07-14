"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { MemberType } from "@/lib/settings-api";

function yen(n: number | null) {
  return n == null ? "—" : `¥${n.toLocaleString()}`;
}

interface MemberTypeCardProps {
  types: MemberType[];
  org: string;
  onUpdated: (updated: MemberType) => void;
  onDeleted: (id: string) => void;
  onCreated: (created: MemberType) => void;
  onToast: (msg: string) => void;
}

export function MemberTypeCard({
  types,
  org,
  onUpdated,
  onDeleted,
  onCreated,
  onToast,
}: MemberTypeCardProps) {
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const startEdit = (t: MemberType) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditAmount(t.defaultFeeAmount != null ? String(t.defaultFeeAmount) : "");
  };

  const confirmEdit = async () => {
    if (!editName.trim() || !editId) return;
    setBusy(true);
    try {
      const amount = editAmount.trim() ? parseInt(editAmount, 10) : null;
      const updated = await settingsApi.updateMemberType(org, editId, {
        name: editName.trim(),
        defaultFeeAmount: amount != null && !isNaN(amount) ? amount : null,
      });
      onUpdated(updated);
      setEditId(null);
    } catch {
      onToast("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteType = async (t: MemberType) => {
    setBusy(true);
    try {
      await settingsApi.deleteMemberType(org, t.id);
      onDeleted(t.id);
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.status === 409
          ? (err as ApiClientError).message || "団員が使用中のため削除できません"
          : "削除に失敗しました";
      onToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const addType = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const amount = newAmount.trim() ? parseInt(newAmount, 10) : null;
      const created = await settingsApi.createMemberType(org, {
        name: newName.trim(),
        defaultFeeAmount: amount != null && !isNaN(amount) ? amount : null,
      });
      onCreated(created);
      setNewName("");
      setNewAmount("");
      setShowAdd(false);
    } catch {
      onToast("追加に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-gray-700">メンバー区分</p>
          <p className="mt-0.5 text-xs text-gray-400">区分ごとにデフォルト会費を設定できます</p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setEditId(null);
          }}
          disabled={busy}
          className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40"
        >
          <Plus size={13} />
          追加
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-2">
        <span className="flex-1 text-xs font-medium text-gray-400">区分名</span>
        <span className="w-28 text-right text-xs font-medium text-gray-400">デフォルト会費</span>
        <span className="w-14" />
      </div>

      <div className="divide-y divide-gray-100">
        {types.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-3">
            {editId === t.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit();
                    if (e.key === "Escape") setEditId(null);
                  }}
                  placeholder="区分名"
                  className="border-brand-300 focus:ring-brand-400 flex-1 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
                />
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="会費（円）"
                  min={0}
                  className="border-brand-300 focus:ring-brand-400 w-28 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
                />
                <button
                  onClick={confirmEdit}
                  disabled={busy}
                  aria-label="保存"
                  className="text-teal-600 hover:text-teal-700 disabled:opacity-40"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => setEditId(null)}
                  aria-label="キャンセル"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800">{t.name}</span>
                <span className="w-28 text-right text-sm text-gray-500">
                  {yen(t.defaultFeeAmount)}
                </span>
                <div className="flex w-14 shrink-0 items-center justify-end gap-0.5">
                  <button
                    onClick={() => startEdit(t)}
                    disabled={busy}
                    className="hover:text-brand-500 p-1.5 text-gray-300 transition-colors disabled:opacity-40"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteType(t)}
                    disabled={busy}
                    className="p-1.5 text-gray-300 transition-colors hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {types.length === 0 && !showAdd && (
          <p className="px-5 py-4 text-sm text-gray-400">区分がまだありません</p>
        )}
      </div>

      {showAdd && (
        <div className="border-brand-100 bg-brand-50/40 flex items-center gap-2 border-t px-5 py-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addType();
              if (e.key === "Escape") {
                setShowAdd(false);
                setNewName("");
                setNewAmount("");
              }
            }}
            placeholder="区分名（例: 社会人）"
            className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
          />
          <input
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="会費（円）"
            min={0}
            className="focus:ring-brand-400 w-28 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
          />
          <button
            onClick={addType}
            disabled={busy}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : "追加"}
          </button>
          <button
            onClick={() => {
              setShowAdd(false);
              setNewName("");
              setNewAmount("");
            }}
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
