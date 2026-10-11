"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DragHandle, SortableItem, useListDndSensors } from "@/components/SortableRow";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { userErrorMessage } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { createSortDragEndHandler } from "@/lib/sort-order";

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
  const [confirmTarget, setConfirmTarget] = useState<EventCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleConfirmDelete = async (cat: EventCategory) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await settingsApi.deleteEventCategory(org, cat.id);
      onDeleted(cat.id);
      setConfirmTarget(null);
    } catch (err) {
      setDeleteError(userErrorMessage(err, "削除に失敗しました。もう一度お試しください。"));
    } finally {
      setDeleting(false);
    }
  };

  const sensors = useListDndSensors();

  const handleDragEnd = createSortDragEndHandler({
    items: categories,
    onReordered,
    persistOne: (c) => settingsApi.updateEventCategory(org, c.id, { sortOrder: c.sortOrder }),
    onError,
    setBusy,
  });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {categories.map((cat) => (
            <SortableItem key={cat.id} id={cat.id}>
              {({ setNodeRef, style, attributes, listeners }) => (
                <div
                  ref={setNodeRef}
                  style={style}
                  data-dnd-row=""
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {editId === cat.id ? (
                    <>
                      <div className="w-7 shrink-0" />
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
                        <DragHandle
                          label={cat.name}
                          attributes={attributes}
                          listeners={listeners}
                          disabled={busy}
                        />
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
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmTarget(cat);
                          }}
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
              )}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
      {confirmTarget && (
        <ConfirmDialog
          title="予定の区分を削除しますか？"
          description={`「${confirmTarget.name}」を削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deleting}
          error={deleteError}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => handleConfirmDelete(confirmTarget)}
        />
      )}
    </DndContext>
  );
}
