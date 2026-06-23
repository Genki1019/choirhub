"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

interface CategoryListProps {
  categories: EventCategory[];
  org: string;
  onUpdated: (updated: EventCategory) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}

export function CategoryList({ categories, org, onUpdated, onDeleted, onError }: CategoryListProps) {
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editColor, setEditColor] = useState("#6B7280");
  const [saving,    setSaving]    = useState(false);

  const startEdit = (cat: EventCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const updated = await settingsApi.updateEventCategory(org, editId, { name: editName, color: editColor });
      onUpdated(updated);
      setEditId(null);
    } catch {
      onError("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteEventCategory(org, id);
      onDeleted(id);
    } catch (err) {
      onError(err instanceof ApiClientError ? err.message : "削除に失敗しました");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
          {editId === cat.id ? (
            <>
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-gray-200"
              />
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
              />
              <button onClick={saveEdit} disabled={saving} aria-label="保存" className="text-blue-600 hover:text-blue-800 disabled:opacity-50">
                <Check size={15} />
              </button>
              <button onClick={cancelEdit} aria-label="キャンセル" className="text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
              {cat.slug && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">標準</span>
              )}
              <button onClick={() => startEdit(cat)} aria-label="編集" className="text-gray-400 hover:text-gray-600">
                <Pencil size={14} />
              </button>
              {!cat.slug && (
                <button onClick={() => handleDelete(cat.id)} aria-label="削除" className="text-gray-400 hover:text-red-500">
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
