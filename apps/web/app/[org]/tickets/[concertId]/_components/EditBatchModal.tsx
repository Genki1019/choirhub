"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ticketsApi, type BatchDetail, type UpdateBatchInput } from "@/lib/tickets-api";
import { BatchFormModal } from "./BatchFormModal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

interface EditBatchModalProps {
  orgSlug: string;
  concertId: string;
  batch: BatchDetail;
  onUpdated: (data: UpdateBatchInput) => void;
  onDeleted: (batchId: string) => void;
  onClose: () => void;
}

export function EditBatchModal({
  orgSlug,
  concertId,
  batch,
  onUpdated,
  onDeleted,
  onClose,
}: EditBatchModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await ticketsApi.deleteBatch(orgSlug, concertId, batch.id);
      onDeleted(batch.id);
    } catch (err) {
      setDeleteError(userErrorMessage(err, "席種の削除に失敗しました。もう一度お試しください。"));
    } finally {
      setDeleting(false);
    }
  };

  const closeConfirm = () => {
    setConfirmDelete(false);
    setDeleteError(null);
  };

  return (
    <>
      <BatchFormModal
        title="席種を編集"
        submitLabel="保存"
        initialValues={{
          name: batch.name,
          price: String(batch.price),
          priceStudent: batch.priceStudent != null ? String(batch.priceStudent) : "",
          totalCount: String(batch.totalCount),
        }}
        onSubmit={async (form) => {
          const data: UpdateBatchInput = {
            name: form.name,
            price: Number(form.price),
            priceStudent: form.priceStudent ? Number(form.priceStudent) : null,
            totalCount: Number(form.totalCount),
          };
          await ticketsApi.updateBatch(orgSlug, concertId, batch.id, data);
          onUpdated(data);
        }}
        onClose={onClose}
        footerStart={
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1 text-xs text-red-400 transition-colors hover:text-red-600"
          >
            <Trash2 size={12} />
            この席種を削除
          </button>
        }
      />

      {confirmDelete && (
        <Modal
          title={`「${batch.name}」を削除しますか？`}
          size="sm"
          onClose={closeConfirm}
          busy={deleting}
          footer={
            <>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={deleting}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                削除する
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-500">
            配布登録データ（{batch.allocations.length}
            件）もすべて削除されます。この操作は元に戻せません。
          </p>
          <ErrorMessage>{deleteError}</ErrorMessage>
        </Modal>
      )}
    </>
  );
}
