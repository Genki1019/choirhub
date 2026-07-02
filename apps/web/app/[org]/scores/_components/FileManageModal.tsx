"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Music2, FolderOpen, Upload, Trash2, Loader2, X } from "lucide-react";
import { scoresApi, type ScoreSummary, type ScoreFile } from "@/lib/scores-api";
import { type PartSummary } from "@/lib/members-api";

// ─── FileRow ───────────────────────────────────────────────────────────────

interface FileRowProps {
  file: ScoreFile;
  canDelete: boolean;
  deleting: string | null;
  onDeleteClick: (file: ScoreFile) => void;
}

function FileRow({ file, canDelete, deleting, onDeleteClick }: FileRowProps) {
  const isDeleting = deleting === file.id;
  const icon = file.fileType === "midi"
    ? <Music2 size={13} className="text-purple-500 shrink-0" />
    : <FileText size={13} className="text-brand-500 shrink-0" />;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg group">
      {icon}
      <span className="flex-1 min-w-0 text-xs text-gray-700 truncate">{file.fileName}</span>
      {canDelete && (
        <button
          onClick={() => onDeleteClick(file)}
          disabled={isDeleting}
          title="削除"
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all disabled:opacity-40 shrink-0"
        >
          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      )}
    </div>
  );
}

// ─── FileSection ───────────────────────────────────────────────────────────

interface FileSectionProps {
  label: string;
  fileList: ScoreFile[];
  canDelete: boolean;
  grouped?: boolean;
  partMap: Map<string, string>;
  deleting: string | null;
  onDeleteClick: (file: ScoreFile) => void;
}

function FileSection({ label, fileList, canDelete, grouped, partMap, deleting, onDeleteClick }: FileSectionProps) {
  if (!grouped) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
        {fileList.length === 0
          ? <p className="text-xs text-gray-300 px-1">登録なし</p>
          : (
            <div className="space-y-1.5">
              {fileList.map((f) => (
                <FileRow key={f.id} file={f} canDelete={canDelete} deleting={deleting} onDeleteClick={onDeleteClick} />
              ))}
            </div>
          )
        }
      </div>
    );
  }

  const groups = new Map<string | null, ScoreFile[]>();
  groups.set(null, []);
  fileList.forEach((f) => {
    const key = f.partId ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  });

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      {fileList.length === 0
        ? <p className="text-xs text-gray-300 px-1">登録なし</p>
        : (
          <div className="space-y-3">
            {groups.get(null)!.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-400 mb-1">全体</p>
                <div className="space-y-1.5">
                  {groups.get(null)!.map((f) => (
                    <FileRow key={f.id} file={f} canDelete={canDelete} deleting={deleting} onDeleteClick={onDeleteClick} />
                  ))}
                </div>
              </div>
            )}
            {Array.from(groups.entries())
              .filter(([k]) => k !== null)
              .map(([partId, pFiles]) => (
                <div key={partId}>
                  <p className="text-[11px] text-gray-400 mb-1">{partMap.get(partId!) ?? partId}</p>
                  <div className="space-y-1.5">
                    {pFiles.map((f) => (
                      <FileRow key={f.id} file={f} canDelete={canDelete} deleting={deleting} onDeleteClick={onDeleteClick} />
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )
      }
    </div>
  );
}

// ─── FileManageModal ───────────────────────────────────────────────────────

interface FileManageModalProps {
  orgSlug: string;
  score: ScoreSummary;
  parts: PartSummary[];
  canManagePdf: boolean;
  canManageMidi: boolean;
  onClose: (updatedFiles: ScoreFile[]) => void;
}

export function FileManageModal({ orgSlug, score, parts, canManagePdf, canManageMidi, onClose }: FileManageModalProps) {
  const [files, setFiles] = useState<ScoreFile[]>(score.files);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ScoreFile | null>(null);

  const initialUploadType = (): "full_score" | "midi" | "other" => {
    const alreadyHasScore = score.files.some((f) => f.fileType === "full_score");
    if (canManagePdf && !alreadyHasScore) return "full_score";
    if (canManageMidi) return "midi";
    return "other";
  };
  const [uploadType, setUploadType] = useState<"full_score" | "midi" | "other">(initialUploadType);
  const [uploadPartId, setUploadPartId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fullScores = files.filter((f) => f.fileType === "full_score");
  const midiFiles  = files.filter((f) => f.fileType === "midi");
  const otherFiles = files.filter((f) => f.fileType === "other");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(files); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, files]);

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    const { id: fileId, fileType } = confirmTarget;
    setConfirmTarget(null);
    setDeleting(fileId);
    setDeleteError(null);
    try {
      await scoresApi.deleteFile(orgSlug, score.id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (fileType === "full_score" && canManagePdf && uploadType !== "full_score") {
        setUploadType("full_score");
      }
    } catch {
      setDeleteError("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { setUploadError("ファイルを選択してください"); return; }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("fileType", uploadType);
    if (uploadPartId) fd.append("partId", uploadPartId);

    setUploading(true);
    setUploadError(null);
    try {
      const created = await scoresApi.uploadFile(orgSlug, score.id, fd);
      setFiles((prev) => [...prev, created]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const partMap = new Map(parts.map((p) => [p.id, p.name]));
  const needsPart = uploadType === "midi";
  const accept = uploadType === "full_score" ? ".pdf"
    : uploadType === "midi"  ? ".mid,.midi,.mp3"
    : ".pdf,.mp3,.wav";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose(files)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <FolderOpen size={15} className="text-brand-500 shrink-0" />
              <h2 className="font-semibold text-gray-800 text-sm">ファイル管理</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{score.title}</p>
          </div>
          <button aria-label="閉じる" onClick={() => onClose(files)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          <FileSection label="楽譜 (PDF)" fileList={fullScores} canDelete={canManagePdf}              partMap={partMap} deleting={deleting} onDeleteClick={setConfirmTarget} />
          <FileSection label="MIDI"       fileList={midiFiles}  canDelete={canManageMidi} grouped     partMap={partMap} deleting={deleting} onDeleteClick={setConfirmTarget} />
          <FileSection label="その他"     fileList={otherFiles} canDelete={canManagePdf}              partMap={partMap} deleting={deleting} onDeleteClick={setConfirmTarget} />
        </div>

        {(canManagePdf || canManageMidi) && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-3 bg-gray-50 rounded-b-2xl">
            <p className="text-xs font-semibold text-gray-600">ファイルを追加</p>
            {canManagePdf && fullScores.length > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                楽譜PDFは1つのみ登録できます。差し替える場合は既存ファイルを削除してから追加してください。
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={uploadType}
                onChange={(e) => {
                  setUploadType(e.target.value as "full_score" | "midi" | "other");
                  setUploadPartId("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
              >
                {canManagePdf && fullScores.length === 0 && <option value="full_score">楽譜 (PDF)</option>}
                {canManageMidi && <option value="midi">MIDI</option>}
                {canManagePdf && <option value="other">その他</option>}
              </select>

              {needsPart && (
                <select
                  value={uploadPartId}
                  onChange={(e) => setUploadPartId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                >
                  <option value="">全体</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="flex-1 text-xs text-gray-600 file:mr-3 file:py-1 file:px-2.5 file:border-0 file:text-xs file:font-medium file:bg-white file:text-brand-600 file:border file:border-brand-200 file:rounded-md hover:file:bg-brand-50 cursor-pointer"
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors shrink-0"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                追加
              </button>
            </div>

            {uploadError && (
              <p className="text-xs text-red-600">{uploadError}</p>
            )}
          </div>
        )}
      </div>

      {confirmTarget && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/20">
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-xs">
            <p className="text-sm font-semibold text-gray-800 mb-1">ファイルを削除しますか？</p>
            <p className="text-xs text-gray-500 mb-4 break-all">{confirmTarget.fileName}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1.5 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
