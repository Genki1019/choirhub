import { Trash2, Loader2 } from "lucide-react";

interface DeleteConfirmModalProps {
  title: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ title, deleting, error, onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={15} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">イベントを削除しますか？</p>
            <p className="text-sm text-gray-500 mt-1">
              「{title}」と出欠情報がすべて削除されます。この操作は取り消せません。
            </p>
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {deleting && <Loader2 size={13} className="animate-spin" />}
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
