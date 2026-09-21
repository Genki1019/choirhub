"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import type { QueryKey } from "@tanstack/react-query";
import { FileAttachmentSection } from "@/components/FileAttachmentSection";
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
  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">
          <FileAttachmentSection
            queryKey={queryKey}
            canManage={canManage}
            listFiles={listFiles}
            uploadFile={uploadFile}
            deleteFile={deleteFile}
          />
        </div>
      </div>
    </div>
  );
}
