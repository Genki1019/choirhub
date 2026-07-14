"use client";

import { useState } from "react";
import { Plus, ChevronUp, ChevronDown, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { PartSummary } from "@/lib/members-api";

interface PartCardProps {
  initialParts: PartSummary[];
  org: string;
  onToast: (msg: string) => void;
}

export function PartCard({ initialParts, org, onToast }: PartCardProps) {
  const [parts, setParts] = useState<PartSummary[]>(initialParts);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const swap = async (idx: number, dir: -1 | 1) => {
    const next = [...parts];
    const other = idx + dir;
    if (other < 0 || other >= next.length) return;
    [next[idx], next[other]] = [next[other], next[idx]];
    const reindexed = next.map((p, i) => ({ ...p, sortOrder: i + 1 }));
    setParts(reindexed);
    setBusy(true);
    try {
      await Promise.all([
        settingsApi.updatePart(org, reindexed[idx].id, { sortOrder: reindexed[idx].sortOrder }),
        settingsApi.updatePart(org, reindexed[other].id, { sortOrder: reindexed[other].sortOrder }),
      ]);
    } catch {
      onToast("並び替えに失敗しました");
      setParts(parts);
    } finally {
      setBusy(false);
    }
  };

  const confirmEdit = async () => {
    if (!editName.trim() || !editId) return;
    setBusy(true);
    try {
      const updated = await settingsApi.updatePart(org, editId, { name: editName.trim() });
      setParts((prev) => prev.map((p) => (p.id === editId ? { ...p, name: updated.name } : p)));
      setEditId(null);
    } catch {
      onToast("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deletePart = async (part: PartSummary) => {
    setBusy(true);
    try {
      await settingsApi.deletePart(org, part.id);
      setParts((prev) =>
        prev.filter((p) => p.id !== part.id).map((p, i) => ({ ...p, sortOrder: i + 1 })),
      );
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.status === 409
          ? "在団メンバーが所属しているため削除できません"
          : "削除に失敗しました";
      onToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const addPart = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const created = await settingsApi.createPart(org, { name: newName.trim() });
      setParts((prev) => [...prev, created]);
      setNewName("");
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
        <p className="text-sm font-semibold text-gray-700">パート一覧</p>
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

      <div className="divide-y divide-gray-100">
        {parts.map((part, idx) => (
          <div key={part.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex shrink-0 flex-col">
              <button
                onClick={() => swap(idx, -1)}
                disabled={idx === 0 || busy}
                className="p-0.5 text-gray-300 transition-colors hover:text-gray-500 disabled:opacity-20"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => swap(idx, 1)}
                disabled={idx === parts.length - 1 || busy}
                className="p-0.5 text-gray-300 transition-colors hover:text-gray-500 disabled:opacity-20"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {editId === part.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit();
                    if (e.key === "Escape") setEditId(null);
                  }}
                  className="border-brand-300 focus:ring-brand-400 flex-1 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
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
                <span className="flex-1 text-sm text-gray-800">{part.name}</span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => {
                      setEditId(part.id);
                      setEditName(part.name);
                    }}
                    disabled={busy}
                    className="hover:text-brand-500 p-1.5 text-gray-300 transition-colors disabled:opacity-40"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deletePart(part)}
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
      </div>

      {showAdd && (
        <div className="border-brand-100 bg-brand-50/40 flex items-center gap-2 border-t px-5 py-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPart();
              if (e.key === "Escape") {
                setShowAdd(false);
                setNewName("");
              }
            }}
            placeholder="パート名を入力"
            className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
          />
          <button
            onClick={addPart}
            disabled={busy}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : "追加"}
          </button>
          <button
            onClick={() => {
              setShowAdd(false);
              setNewName("");
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
