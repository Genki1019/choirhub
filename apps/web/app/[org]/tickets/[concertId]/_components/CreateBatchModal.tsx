"use client";

import { ticketsApi, type BatchDetail } from "@/lib/tickets-api";
import { BatchFormModal } from "./BatchFormModal";

interface CreateBatchModalProps {
  orgSlug: string;
  concertId: string;
  onCreated: (batch: BatchDetail) => void;
  onClose: () => void;
}

export function CreateBatchModal({ orgSlug, concertId, onCreated, onClose }: CreateBatchModalProps) {
  return (
    <BatchFormModal
      title="席種を追加"
      submitLabel="追加"
      initialValues={{ name: "", price: "", priceStudent: "", totalCount: "" }}
      onSubmit={async (form) => {
        const batch = await ticketsApi.createBatch(orgSlug, concertId, {
          name:         form.name,
          price:        Number(form.price),
          priceStudent: form.priceStudent ? Number(form.priceStudent) : null,
          totalCount:   Number(form.totalCount),
        });
        onCreated(batch);
      }}
      onClose={onClose}
    />
  );
}
