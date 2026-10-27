"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DragHandle, SortableItem, useListDndSensors } from "@/components/SortableRow";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { userErrorMessage } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { useBusy } from "@/hooks/useBusy";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { createSortDragEndHandler } from "@/lib/sort-order";

function CategoryRowFields({
  cat,
  org,
  canEdit,
  busy,
  runBusy,
  onUpdated,
  onDeleteClick,
}: {
  cat: EventCategory;
  org: string;
  canEdit: boolean;
  busy: boolean;
  runBusy: <T>(task: () => Promise<T>) => Promise<T>;
  onUpdated: (updated: EventCategory) => void;
  onDeleteClick: () => void;
}) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => ({ name: cat.name, color: cat.color }),
    validate: ({ name }) => (name.trim() ? null : "区分名を入力してください"),
    onSave: async ({ name, color }) => {
      onUpdated(
        await runBusy(() =>
          settingsApi.updateEventCategory(org, cat.id, { name: name.trim(), color }),
        ),
      );
    },
    errorFallback: "区分の保存に失敗しました。もう一度お試しください。",
    disabled: busy,
  });

  if (edit.editing) {
    return (
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="区分の色"
            value={edit.value.color}
            onChange={(e) => edit.setValue({ ...edit.value, color: e.target.value })}
            onKeyDown={edit.handleKeyDown}
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-gray-200"
          />
          <input
            autoFocus
            aria-label="区分名"
            value={edit.value.name}
            onChange={(e) => edit.setValue({ ...edit.value, name: e.target.value })}
            onKeyDown={edit.handleKeyDown}
            className="focus:ring-brand-400 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:ring-1 focus:outline-none"
          />
          <InlineEditActions
            label="区分"
            saving={edit.saving}
            saveDisabled={busy}
            onSave={edit.save}
            onCancel={edit.cancel}
          />
        </div>
        <ErrorMessage>{edit.error}</ErrorMessage>
      </div>
    );
  }

  return (
    <>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
      <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
      {cat.slug && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">標準</span>
      )}
      {canEdit && (
        <InlineEditButton
          ref={registerTrigger}
          label={cat.name}
          onClick={edit.start}
          disabled={busy}
        />
      )}
      {canEdit && !cat.slug && (
        <button
          type="button"
          onClick={onDeleteClick}
          disabled={busy}
          aria-label={`${cat.name}を削除`}
          className="text-gray-400 hover:text-red-500 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      )}
    </>
  );
}

interface CategoryListProps {
  categories: EventCategory[];
  org: string;
  canEdit: boolean;
  onUpdated: (updated: EventCategory) => void;
  onDeleted: (id: string) => void;
  onReordered: (reordered: EventCategory[]) => void;
  onError: (msg: string | null) => void;
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
  const { busy, setBusy, runBusy } = useBusy();
  const [confirmTarget, setConfirmTarget] = useState<EventCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
                  {canEdit && (
                    <DragHandle
                      label={cat.name}
                      attributes={attributes}
                      listeners={listeners}
                      disabled={busy}
                    />
                  )}
                  <CategoryRowFields
                    cat={cat}
                    org={org}
                    canEdit={canEdit}
                    busy={busy}
                    runBusy={runBusy}
                    onUpdated={onUpdated}
                    onDeleteClick={() => {
                      setDeleteError(null);
                      setConfirmTarget(cat);
                    }}
                  />
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
