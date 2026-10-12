"use client";

import { useState } from "react";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DragHandle, SortableItem, useListDndSensors } from "@/components/SortableRow";
import { settingsApi } from "@/lib/settings-api";
import { userErrorMessage } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { useBusy } from "@/hooks/useBusy";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { createSortDragEndHandler } from "@/lib/sort-order";
import type { ExpenseCategory } from "@/lib/accounting-api";

function ExpenseCategoryRowName({
  cat,
  org,
  busy,
  runBusy,
  onUpdated,
  onDeleteClick,
}: {
  cat: ExpenseCategory;
  org: string;
  busy: boolean;
  runBusy: <T>(task: () => Promise<T>) => Promise<T>;
  onUpdated: (updated: ExpenseCategory) => void;
  onDeleteClick: () => void;
}) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => cat.name,
    validate: (name) => (name.trim() ? null : "カテゴリ名を入力してください"),
    onSave: async (name) => {
      onUpdated(
        await runBusy(() => settingsApi.updateExpenseCategory(org, cat.id, { name: name.trim() })),
      );
    },
    errorFallback: "カテゴリ名の保存に失敗しました。もう一度お試しください。",
    disabled: busy,
  });

  if (edit.editing) {
    return (
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            aria-label="カテゴリ名"
            value={edit.value}
            onChange={(e) => edit.setValue(e.target.value)}
            onKeyDown={edit.handleKeyDown}
            className="border-brand-300 focus:ring-brand-400 min-w-0 flex-1 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
          />
          <InlineEditActions
            label="カテゴリ名"
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
      <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        <InlineEditButton
          ref={registerTrigger}
          label={cat.name}
          onClick={edit.start}
          disabled={busy}
        />
        <button
          type="button"
          onClick={onDeleteClick}
          disabled={busy}
          aria-label={`${cat.name}を削除`}
          className="p-1.5 text-gray-300 transition-colors hover:text-red-500 disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </>
  );
}

interface ExpenseCategoryCardProps {
  cats: ExpenseCategory[];
  org: string;
  onUpdated: (updated: ExpenseCategory) => void;
  onDeleted: (id: string) => void;
  onCreated: (created: ExpenseCategory) => void;
  onReordered: (reordered: ExpenseCategory[]) => void;
  onToast: (msg: string) => void;
}

export function ExpenseCategoryCard({
  cats,
  org,
  onUpdated,
  onDeleted,
  onCreated,
  onReordered,
  onToast,
}: ExpenseCategoryCardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const { busy, setBusy, runBusy } = useBusy();
  const [confirmTarget, setConfirmTarget] = useState<ExpenseCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async (cat: ExpenseCategory) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await settingsApi.deleteExpenseCategory(org, cat.id);
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
    items: cats,
    onReordered,
    persistOne: (c) => settingsApi.updateExpenseCategory(org, c.id, { sortOrder: c.sortOrder }),
    onError: onToast,
    setBusy,
  });

  const addCategory = async () => {
    if (busy || !newName.trim()) return;
    try {
      const created = await runBusy(() =>
        settingsApi.createExpenseCategory(org, { name: newName.trim() }),
      );
      onCreated(created);
      setNewName("");
      setShowAdd(false);
    } catch {
      onToast("追加に失敗しました");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <p className="text-sm font-semibold text-gray-700">支出カテゴリ</p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={busy}
          className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40"
        >
          <Plus size={13} />
          追加
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100">
            {cats.map((cat) => (
              <SortableItem key={cat.id} id={cat.id}>
                {({ setNodeRef, style, attributes, listeners }) => (
                  <div
                    ref={setNodeRef}
                    style={style}
                    data-dnd-row=""
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <DragHandle
                      label={cat.name}
                      attributes={attributes}
                      listeners={listeners}
                      disabled={busy}
                    />
                    <ExpenseCategoryRowName
                      cat={cat}
                      org={org}
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

            {cats.length === 0 && !showAdd && (
              <p className="px-5 py-4 text-sm text-gray-400">カテゴリがまだありません</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {showAdd && (
        <div className="border-brand-100 bg-brand-50/40 flex items-center gap-2 border-t px-5 py-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCategory();
              if (e.key === "Escape") {
                setShowAdd(false);
                setNewName("");
              }
            }}
            placeholder="カテゴリ名を入力"
            className="focus:ring-brand-400 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={busy}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : "追加"}
          </button>
          <button
            type="button"
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
      {confirmTarget && (
        <ConfirmDialog
          title="支出の区分を削除しますか？"
          description={`「${confirmTarget.name}」を削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deleting}
          error={deleteError}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => handleConfirmDelete(confirmTarget)}
        />
      )}
    </div>
  );
}
