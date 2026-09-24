"use client";

import { useState } from "react";
import { DeleteOrgModal } from "./DeleteOrgModal";

interface DangerZoneProps {
  orgSlug: string;
  orgName: string;
}

export function DangerZone({ orgSlug, orgName }: DangerZoneProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="rounded-xl border border-red-100 bg-white px-6 py-5">
      <h2 className="mb-3 text-sm font-semibold text-red-500">危険な操作</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-700">この団体を削除する</p>
          <p className="mt-0.5 text-xs text-gray-400">
            削除から30日後に全データが完全に削除されます。30日以内であれば復元できます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
        >
          削除
        </button>
      </div>
      {showDeleteModal && (
        <DeleteOrgModal
          orgSlug={orgSlug}
          orgName={orgName}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
