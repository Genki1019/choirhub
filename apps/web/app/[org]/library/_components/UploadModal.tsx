"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { documentsApi, type DocumentCategory, type DocumentAccessLevel } from "@/lib/documents-api";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "bylaws", label: "規約・規則" },
  { value: "minutes", label: "議事録" },
  { value: "member_guide", label: "団員ガイド" },
  { value: "finance_report", label: "会計報告" },
  { value: "other", label: "その他" },
];

const ACCESS_LEVEL_OPTIONS: { value: DocumentAccessLevel; label: string }[] = [
  { value: "public", label: "客演にも公開" },
  { value: "restricted", label: "団員限定" },
  { value: "secret", label: "管理者限定" },
];

const TITLE_MAX = 100;

const fieldClass =
  "focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none";

interface UploadModalProps {
  org: string;
  defaultCategory: DocumentCategory;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadModal({ org, defaultCategory, onClose, onSuccess }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [accessLevel, setAccessLevel] = useState<DocumentAccessLevel>("restricted");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uploading) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await documentsApi.upload(org, file, { title: title.trim(), category, accessLevel });
      onSuccess();
    } catch (err) {
      setError(userErrorMessage(err, "アップロードに失敗しました。もう一度お試しください。"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="資料を追加"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={uploading}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            aria-disabled={uploading}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors aria-disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            アップロード
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="doc-title" className="mb-1 block text-xs font-medium text-gray-500">
          タイトル <span className="text-red-400">*</span>
        </label>
        <input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="団則、〇年度総会議事録 など"
          className={fieldClass}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="doc-category" className="mb-1 block text-xs font-medium text-gray-500">
          カテゴリ
        </label>
        <select
          id="doc-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          className={`${fieldClass} bg-white`}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="doc-access" className="mb-1 block text-xs font-medium text-gray-500">
          公開範囲
        </label>
        <select
          id="doc-access"
          value={accessLevel}
          onChange={(e) => setAccessLevel(e.target.value as DocumentAccessLevel)}
          className={`${fieldClass} bg-white`}
        >
          {ACCESS_LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="doc-file" className="mb-1 block text-xs font-medium text-gray-500">
          ファイル（PDF） <span className="text-red-400">*</span>
        </label>
        <input
          id="doc-file"
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="file:text-brand-600 file:border-brand-200 hover:file:bg-brand-50 w-full cursor-pointer text-xs text-gray-600 file:mr-3 file:rounded-md file:border file:border-0 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium"
        />
      </div>

      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
