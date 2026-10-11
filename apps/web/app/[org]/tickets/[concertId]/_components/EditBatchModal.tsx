"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ticketsApi, type BatchDetail, type UpdateBatchInput } from "@/lib/tickets-api";
import { BatchFormModal } from "./BatchFormModal";
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
        <ConfirmDialog
          title="席種を削除しますか？"
          description={`「${batch.name}」と、配布登録データ（${batch.allocations.length}件）がすべて削除されます。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deleting}
          error={deleteError}
          onCancel={closeConfirm}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
