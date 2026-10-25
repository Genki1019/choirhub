"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { AttachmentFile } from "@/lib/file-attachment-api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

const LABEL_OPTIONS = ["フライヤー", "しおり", "行程表", "資料", "その他"] as const;
const OTHER_LABEL = "その他";
const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export const attachmentUploadKey = (queryKey: QueryKey) => [...queryKey, "upload"];

interface FileAttachmentSectionProps {
  queryKey: QueryKey;
  canManage: boolean;
  listFiles: () => Promise<AttachmentFile[]>;
  uploadFile: (file: File, label: string) => Promise<AttachmentFile>;
  deleteFile: (fileId: string) => Promise<void>;
  title?: string;
  accept?: string;
  labelInput?: "select" | "text";
  renderFile?: (file: AttachmentFile) => ReactNode;
}

export function FileAttachmentSection({
  queryKey,
  canManage,
  listFiles,
  uploadFile,
  deleteFile,
  title,
  accept = DEFAULT_ACCEPT,
  labelInput = "select",
  renderFile,
}: FileAttachmentSectionProps) {
  const queryClient = useQueryClient();
  const {
    data: files = [],
    isLoading,
    error: loadError,
  } = useQuery({ queryKey, queryFn: listFiles });

  const [selectedLabel, setSelectedLabel] = useState<string>(LABEL_OPTIONS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [textLabel, setTextLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AttachmentFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveLabel = () => {
    if (labelInput === "text") return textLabel.trim();
    return selectedLabel === OTHER_LABEL ? customLabel.trim() : selectedLabel;
  };

  const uploadMutation = useMutation({
    mutationKey: attachmentUploadKey(queryKey),
    mutationFn: ({ file, label }: { file: File; label: string }) => uploadFile(file, label),
    onSuccess: (created) => {
      if (queryClient.getQueryData(queryKey)) {
        queryClient.setQueryData<AttachmentFile[]>(queryKey, (prev) => [...(prev ?? []), created]);
      } else {
        void queryClient.invalidateQueries({ queryKey });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      setCustomLabel("");
      setTextLabel("");
      setUploadError(null);
    },
    onError: (err) => {
      setUploadError(userErrorMessage(err, "アップロードに失敗しました。もう一度お試しください。"));
    },
  });

  const handleUpload = () => {
    if (uploadMutation.isPending) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("ファイルを選択してください");
      return;
    }
    const label = resolveLabel();
    if (!label) {
      setUploadError("ラベルを入力してください");
      return;
    }
    setUploadError(null);
    uploadMutation.mutate({ file, label });
  };

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: (_result, fileId) => {
      queryClient.setQueryData<AttachmentFile[]>(queryKey, (prev) =>
        (prev ?? []).filter((f) => f.id !== fileId),
      );
      setConfirmTarget(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(userErrorMessage(err, "削除に失敗しました。もう一度お試しください。"));
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
      ) : loadError ? (
        <ErrorMessage autoScroll={false}>
          {userErrorMessage(
            loadError,
            "ファイルの読み込みに失敗しました。ページを再読み込みしてください。",
          )}
        </ErrorMessage>
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
              {renderFile ? (
                renderFile(f)
              ) : f.downloadUrl ? (
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
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmTarget(f);
                  }}
                  disabled={deleteMutation.isPending}
                  aria-label={`${f.fileName}を削除`}
                  title="削除"
                  className="shrink-0 text-gray-400 transition-colors hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {labelInput === "text" ? (
              <input
                type="text"
                aria-label="ラベル"
                value={textLabel}
                onChange={(e) => setTextLabel(e.target.value)}
                placeholder="曲名・パート名など"
                className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
              />
            ) : (
              <>
                <select
                  aria-label="ラベル"
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
                    aria-label="ラベル（その他）"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="ラベルを入力"
                    className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                  />
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              aria-label="追加するファイル"
              type="file"
              accept={accept}
              className="file:text-brand-600 file:border-brand-200 hover:file:bg-brand-50 flex-1 cursor-pointer text-xs text-gray-600 file:mr-3 file:rounded-md file:border file:border-0 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium"
            />
            <button
              type="button"
              onClick={handleUpload}
              aria-disabled={uploadMutation.isPending}
              className="bg-brand-600 hover:bg-brand-700 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors aria-disabled:opacity-60"
            >
              {uploadMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              追加
            </button>
          </div>
          <ErrorMessage>{uploadError}</ErrorMessage>
        </div>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="ファイルを削除しますか？"
          description={`「${confirmTarget.fileName}」を削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deleteMutation.isPending}
          error={deleteError}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => deleteMutation.mutate(confirmTarget.id)}
        />
      )}
    </div>
  );
}
