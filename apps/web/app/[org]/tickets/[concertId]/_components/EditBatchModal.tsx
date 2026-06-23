"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { ticketsApi, type BatchDetail, type UpdateBatchInput } from "@/lib/tickets-api";
import { BatchFormModal } from "./BatchFormModal";

interface EditBatchModalProps {
  orgSlug: string;
  concertId: string;
  batch: BatchDetail;
  onUpdated: (data: UpdateBatchInput) => void;
  onDeleted: (batchId: string) => void;
  onClose: () => void;
}

export function EditBatchModal({
  orgSlug, concertId, batch, onUpdated, onDeleted, onClose,
}: EditBatchModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await ticketsApi.deleteBatch(orgSlug, concertId, batch.id);
      onDeleted(batch.id);
    } finally {
      setDeleting(false);
    }
  };

  if (confirmDelete) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <p className="text-sm font-semibold text-gray-800 mb-1">
            「{batch.name}」を削除しますか？
          </p>
          <p className="text-xs text-gray-500 mb-5">
            配布登録データ（{batch.allocations.length}件）もすべて削除されます。この操作は元に戻せません。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
            >
              {deleting && <Loader2 size={13} className="animate-spin" />}
              削除する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BatchFormModal
      title="席種を編集"
      submitLabel="保存"
      initialValues={{
        name:         batch.name,
        price:        String(batch.price),
        priceStudent: batch.priceStudent != null ? String(batch.priceStudent) : "",
        totalCount:   String(batch.totalCount),
      }}
      onSubmit={async (form) => {
        const data: UpdateBatchInput = {
          name:         form.name,
          price:        Number(form.price),
          priceStudent: form.priceStudent ? Number(form.priceStudent) : null,
          totalCount:   Number(form.totalCount),
        };
        await ticketsApi.updateBatch(orgSlug, concertId, batch.id, data);
        onUpdated(data);
      }}
      onClose={onClose}
      extraFooter={
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors mt-3"
        >
          <Trash2 size={12} />
          この席種を削除
        </button>
      }
    />
  );
}
