"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { documentsApi, type DocumentCategory, type DocumentAccessLevel } from "@/lib/documents-api";

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
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
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
    } catch {
      setError("アップロードに失敗しました。もう一度お試しください");
    } finally {
      setUploading(false);
    }
  };

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
          <h2 className="text-base font-semibold text-gray-800">資料を追加</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="doc-title" className="mb-1 block text-xs font-medium text-gray-500">
              タイトル <span className="text-red-400">*</span>
            </label>
            <input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="団則、〇年度総会議事録 など"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              アップロード
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
