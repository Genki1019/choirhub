"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { AttachmentFile } from "@/lib/file-attachment-api";

const LABEL_OPTIONS = ["フライヤー", "しおり", "行程表", "資料", "その他"] as const;
const OTHER_LABEL = "その他";

interface FileAttachmentSectionProps {
  queryKey: QueryKey;
  canManage: boolean;
  listFiles: () => Promise<AttachmentFile[]>;
  uploadFile: (file: File, label: string) => Promise<AttachmentFile>;
  deleteFile: (fileId: string) => Promise<void>;
  title?: string;
}

export function FileAttachmentSection({
  queryKey,
  canManage,
  listFiles,
  uploadFile,
  deleteFile,
  title,
}: FileAttachmentSectionProps) {
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useQuery({ queryKey, queryFn: listFiles });

  const [selectedLabel, setSelectedLabel] = useState<string>(LABEL_OPTIONS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AttachmentFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = fileInputRef.current?.files?.[0];
      if (!file) throw new Error("ファイルを選択してください");
      const label = selectedLabel === OTHER_LABEL ? customLabel.trim() : selectedLabel;
      if (!label) throw new Error("ラベルを入力してください");
      return uploadFile(file, label);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<AttachmentFile[]>(queryKey, (prev) => [...(prev ?? []), created]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setCustomLabel("");
      setUploadError(null);
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: (_result, fileId) => {
      queryClient.setQueryData<AttachmentFile[]>(queryKey, (prev) =>
        (prev ?? []).filter((f) => f.id !== fileId),
      );
      setConfirmTarget(null);
      setDeleteError(null);
    },
    onError: () => {
      setDeleteError("削除に失敗しました");
    },
  });

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center gap-1.5">
          <Paperclip size={14} className="text-gray-400" />
          <p className="text-xs font-semibold text-gray-600">{title}</p>
        </div>
      )}

      {isLoading ? (
        <p className="px-1 text-xs text-gray-300">読み込み中…</p>
      ) : files.length === 0 ? (
        <p className="px-1 text-xs text-gray-300">登録されているファイルはありません</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="group flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
            >
              <FileText size={13} className="text-brand-500 shrink-0" />
              <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500">
                {f.label}
              </span>
              {f.downloadUrl ? (
                <a
                  href={f.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs text-gray-700 hover:underline"
                >
                  {f.fileName}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{f.fileName}</span>
              )}
              {canManage && (
                <button
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmTarget(f);
                  }}
                  disabled={deleteMutation.isPending}
                  title="削除"
                  className="shrink-0 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500 disabled:opacity-40"
                >
                  {deleteMutation.isPending && confirmTarget?.id === f.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
            >
              {LABEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {selectedLabel === OTHER_LABEL && (
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="ラベルを入力"
                className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="file:text-brand-600 file:border-brand-200 hover:file:bg-brand-50 flex-1 cursor-pointer text-xs text-gray-600 file:mr-3 file:rounded-md file:border file:border-0 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium"
            />
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
              className="bg-brand-600 hover:bg-brand-700 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
            >
              {uploadMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              追加
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="w-full max-w-xs rounded-xl bg-white p-5 shadow-lg">
            <p className="mb-1 text-sm font-semibold text-gray-800">ファイルを削除しますか？</p>
            <p className="mb-4 text-xs break-all text-gray-500">{confirmTarget.fileName}</p>
            {deleteError && <p className="mb-3 text-xs text-red-600">{deleteError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {deleteMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
