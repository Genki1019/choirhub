"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2, Check, X } from "lucide-react";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

interface CategoryListProps {
  categories: EventCategory[];
  org: string;
  canEdit: boolean;
  onUpdated: (updated: EventCategory) => void;
  onDeleted: (id: string) => void;
  onReordered: (reordered: EventCategory[]) => void;
  onError: (msg: string) => void;
}

export function CategoryList({
  categories,
  org,
  canEdit,
  onUpdated,
  onDeleted,
  onReordered,
  onError,
}: CategoryListProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6B7280");
  const [busy, setBusy] = useState(false);

  const startEdit = (cat: EventCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if (!editId) return;
    setBusy(true);
    try {
      const updated = await settingsApi.updateEventCategory(org, editId, {
        name: editName,
        color: editColor,
      });
      onUpdated(updated);
      setEditId(null);
    } catch {
      onError("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await settingsApi.deleteEventCategory(org, id);
      onDeleted(id);
    } catch (err) {
      onError(err instanceof ApiClientError ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const swap = async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= categories.length) return;
    const snapshot = [...categories];
    const next = [...categories];
    [next[idx], next[other]] = [next[other], next[idx]];
    const reindexed = next.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    onReordered(reindexed);
    setBusy(true);
    try {
      await Promise.all([
        settingsApi.updateEventCategory(org, reindexed[idx].id, {
          sortOrder: reindexed[idx].sortOrder,
        }),
        settingsApi.updateEventCategory(org, reindexed[other].id, {
          sortOrder: reindexed[other].sortOrder,
        }),
      ]);
    } catch {
      onReordered(snapshot);
      onError("並び替えに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {categories.map((cat, idx) => (
        <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
          {editId === cat.id ? (
            <>
              <div className="w-5 shrink-0" />
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border border-gray-200"
              />
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:ring-1 focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveEdit}
                disabled={busy}
                aria-label="保存"
                className="text-brand-600 hover:text-brand-800 disabled:opacity-50"
              >
                <Check size={15} />
              </button>
              <button
                onClick={cancelEdit}
                aria-label="キャンセル"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => swap(idx, -1)}
                    disabled={idx === 0 || busy}
                    aria-label={`${cat.name}を上に移動`}
                    className="p-0.5 text-gray-300 transition-colors hover:text-gray-500 disabled:opacity-20"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => swap(idx, 1)}
                    disabled={idx === categories.length - 1 || busy}
                    aria-label={`${cat.name}を下に移動`}
                    className="p-0.5 text-gray-300 transition-colors hover:text-gray-500 disabled:opacity-20"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
              {cat.slug && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                  標準
                </span>
              )}
              {canEdit && (
                <button
                  onClick={() => startEdit(cat)}
                  disabled={busy}
                  aria-label={`${cat.name}を編集`}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                >
                  <Pencil size={14} />
                </button>
              )}
              {canEdit && !cat.slug && (
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={busy}
                  aria-label={`${cat.name}を削除`}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
