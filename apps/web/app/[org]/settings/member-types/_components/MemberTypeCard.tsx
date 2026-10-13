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
import type { MemberType } from "@/lib/settings-api";

const toFee = (amount: string) => (amount.trim() ? Number(amount.trim()) : null);

function yen(n: number | null) {
  return n == null ? "—" : `¥${n.toLocaleString()}`;
}

function MemberTypeRowFields({
  type,
  org,
  canEdit,
  busy,
  runBusy,
  onUpdated,
  onDeleteClick,
}: {
  type: MemberType;
  org: string;
  canEdit: boolean;
  busy: boolean;
  runBusy: <T>(task: () => Promise<T>) => Promise<T>;
  onUpdated: (updated: MemberType) => void;
  onDeleteClick: () => void;
}) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => ({
      name: type.name,
      amount: type.defaultFeeAmount != null ? String(type.defaultFeeAmount) : "",
    }),
    validate: ({ name, amount }) => {
      if (!name.trim()) return "区分名を入力してください";
      if (amount.trim() && !/^\d+$/.test(amount.trim()))
        return "会費は0以上の整数で入力してください";
      return null;
    },
    onSave: async ({ name, amount }) => {
      onUpdated(
        await runBusy(() =>
          settingsApi.updateMemberType(org, type.id, {
            name: name.trim(),
            defaultFeeAmount: toFee(amount),
          }),
        ),
      );
    },
    isEqual: (a, b) => a.name.trim() === b.name.trim() && toFee(a.amount) === toFee(b.amount),
    errorFallback: "メンバー区分の保存に失敗しました。もう一度お試しください。",
    disabled: busy,
  });

  if (edit.editing) {
    return (
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            aria-label="区分名"
            value={edit.value.name}
            onChange={(e) => edit.setValue({ ...edit.value, name: e.target.value })}
            onKeyDown={edit.handleKeyDown}
            placeholder="区分名"
            className="border-brand-300 focus:ring-brand-400 min-w-0 flex-1 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
          />
          <input
            type="text"
            inputMode="numeric"
            aria-label="デフォルト会費"
            value={edit.value.amount}
            onChange={(e) => edit.setValue({ ...edit.value, amount: e.target.value })}
            onKeyDown={edit.handleKeyDown}
            placeholder="会費（円）"
            className="border-brand-300 focus:ring-brand-400 w-28 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
          />
          <InlineEditActions
            label="メンバー区分"
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
      <span className="flex-1 text-sm text-gray-800">{type.name}</span>
      <span className="w-28 text-right text-sm text-gray-500">{yen(type.defaultFeeAmount)}</span>
      {canEdit && (
        <div className="flex w-14 shrink-0 items-center justify-end gap-0.5">
          <InlineEditButton
            ref={registerTrigger}
            label={type.name}
            onClick={edit.start}
            disabled={busy}
          />
          <button
            type="button"
            onClick={onDeleteClick}
            disabled={busy}
            aria-label={`${type.name}を削除`}
            className="p-1.5 text-gray-300 transition-colors hover:text-red-500 disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </>
  );
}

interface MemberTypeCardProps {
  types: MemberType[];
  org: string;
  canEdit: boolean;
  onUpdated: (updated: MemberType) => void;
  onDeleted: (id: string) => void;
  onCreated: (created: MemberType) => void;
  onReordered: (reordered: MemberType[]) => void;
  onToast: (msg: string) => void;
}

export function MemberTypeCard({
  types,
  org,
  canEdit,
  onUpdated,
  onDeleted,
  onCreated,
  onReordered,
  onToast,
}: MemberTypeCardProps) {
  const { busy, setBusy, runBusy } = useBusy();
  const [confirmTarget, setConfirmTarget] = useState<MemberType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const handleConfirmDelete = async (t: MemberType) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await settingsApi.deleteMemberType(org, t.id);
      onDeleted(t.id);
      setConfirmTarget(null);
    } catch (err) {
      setDeleteError(userErrorMessage(err, "削除に失敗しました。もう一度お試しください。"));
    } finally {
      setDeleting(false);
    }
  };

  const sensors = useListDndSensors();

  const handleDragEnd = createSortDragEndHandler({
    items: types,
    onReordered,
    persistOne: (t) => settingsApi.updateMemberType(org, t.id, { sortOrder: t.sortOrder }),
    onError: onToast,
    setBusy,
  });

  const addType = async () => {
    if (busy || !newName.trim()) return;
    try {
      const amount = newAmount.trim() ? parseInt(newAmount, 10) : null;
      const created = await runBusy(() =>
        settingsApi.createMemberType(org, {
          name: newName.trim(),
          defaultFeeAmount: amount != null && !isNaN(amount) ? amount : null,
        }),
      );
      onCreated(created);
      setNewName("");
      setNewAmount("");
      setShowAdd(false);
    } catch {
      onToast("追加に失敗しました");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-gray-700">メンバー区分</p>
          <p className="mt-0.5 text-xs text-gray-400">区分ごとにデフォルト会費を設定できます</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={busy}
            className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40"
          >
            <Plus size={13} />
            追加
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-2">
        {canEdit && <span className="w-6 shrink-0" />}
        <span className="flex-1 text-xs font-medium text-gray-400">区分名</span>
        <span className="w-28 text-right text-xs font-medium text-gray-400">デフォルト会費</span>
        <span className="w-14" />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={types.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100">
            {types.map((t) => (
              <SortableItem key={t.id} id={t.id}>
                {({ setNodeRef, style, attributes, listeners }) => (
                  <div
                    ref={setNodeRef}
                    style={style}
                    data-dnd-row=""
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    {canEdit && (
                      <DragHandle
                        label={t.name}
                        attributes={attributes}
                        listeners={listeners}
                        disabled={busy}
                      />
                    )}
                    <MemberTypeRowFields
                      type={t}
                      org={org}
                      canEdit={canEdit}
                      busy={busy}
                      runBusy={runBusy}
                      onUpdated={onUpdated}
                      onDeleteClick={() => {
                        setDeleteError(null);
                        setConfirmTarget(t);
                      }}
                    />
                  </div>
                )}
              </SortableItem>
            ))}

            {types.length === 0 && !showAdd && (
              <p className="px-5 py-4 text-sm text-gray-400">区分がまだありません</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {canEdit && showAdd && (
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
            type="button"
            onClick={addType}
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
              setNewAmount("");
            }}
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {confirmTarget && (
        <ConfirmDialog
          title="団員種別を削除しますか？"
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
