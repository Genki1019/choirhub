import { Trash2, Loader2 } from "lucide-react";

interface DeleteConfirmModalProps {
  title: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  title,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <Trash2 size={15} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">イベントを削除しますか？</p>
            <p className="mt-1 text-sm text-gray-500">
              「{title}」と出欠情報がすべて削除されます。この操作は取り消せません。
            </p>
          </div>
        </div>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <Loader2 size={13} className="animate-spin" />}
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
