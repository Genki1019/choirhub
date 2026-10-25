"use client";

import { useIsMutating, type QueryKey } from "@tanstack/react-query";
import { attachmentUploadKey, FileAttachmentSection } from "@/components/FileAttachmentSection";
import { Modal } from "@/components/Modal";
import type { AttachmentFile } from "@/lib/file-attachment-api";

interface ResourceFilesModalProps {
  title: string;
  queryKey: QueryKey;
  canManage: boolean;
  listFiles: () => Promise<AttachmentFile[]>;
  uploadFile: (file: File, label: string) => Promise<AttachmentFile>;
  deleteFile: (fileId: string) => Promise<void>;
  onClose: () => void;
}

/** 本番・イベントの添付ファイルを、対象を選択した後にモーダル内で管理するための薄いラッパー */
export function ResourceFilesModal({
  title,
  queryKey,
  canManage,
  listFiles,
  uploadFile,
  deleteFile,
  onClose,
}: ResourceFilesModalProps) {
  const uploading = useIsMutating({ mutationKey: attachmentUploadKey(queryKey) }) > 0;
  return (
    <Modal title={title} onClose={onClose} busy={uploading}>
      <FileAttachmentSection
        queryKey={queryKey}
        canManage={canManage}
        listFiles={listFiles}
        uploadFile={uploadFile}
        deleteFile={deleteFile}
      />
    </Modal>
  );
}
