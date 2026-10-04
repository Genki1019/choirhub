"use client";

import { useState, useRef } from "react";
import { FileText, Music2, FolderOpen, Upload, Trash2, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { scoresApi, type ScoreDetail, type ScoreFile } from "@/lib/scores-api";
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
  const icon =
    file.fileType === "midi" ? (
      <Music2 size={13} className="shrink-0 text-purple-500" />
    ) : (
      <FileText size={13} className="text-brand-500 shrink-0" />
    );
  return (
    <div className="group flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      {icon}
      <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{file.fileName}</span>
      {canDelete && (
        <button
          onClick={() => onDeleteClick(file)}
          disabled={isDeleting}
          title="削除"
          className="shrink-0 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500 disabled:opacity-40"
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

function FileSection({
  label,
  fileList,
  canDelete,
  grouped,
  partMap,
  deleting,
  onDeleteClick,
}: FileSectionProps) {
  if (!grouped) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-500">{label}</p>
        {fileList.length === 0 ? (
          <p className="px-1 text-xs text-gray-300">登録なし</p>
        ) : (
          <div className="space-y-1.5">
            {fileList.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                canDelete={canDelete}
                deleting={deleting}
                onDeleteClick={onDeleteClick}
              />
            ))}
          </div>
        )}
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
      <p className="mb-1.5 text-xs font-semibold text-gray-500">{label}</p>
      {fileList.length === 0 ? (
        <p className="px-1 text-xs text-gray-300">登録なし</p>
      ) : (
        <div className="space-y-3">
          {groups.get(null)!.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] text-gray-400">全体</p>
              <div className="space-y-1.5">
                {groups.get(null)!.map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    canDelete={canDelete}
                    deleting={deleting}
                    onDeleteClick={onDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}
          {Array.from(groups.entries())
            .filter(([k]) => k !== null)
            .map(([partId, pFiles]) => (
              <div key={partId}>
                <p className="mb-1 text-[11px] text-gray-400">{partMap.get(partId!) ?? partId}</p>
                <div className="space-y-1.5">
                  {pFiles.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      canDelete={canDelete}
                      deleting={deleting}
                      onDeleteClick={onDeleteClick}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── FileManageModal ───────────────────────────────────────────────────────

interface FileManageModalProps {
  orgSlug: string;
  score: ScoreDetail;
  parts: PartSummary[];
  canManagePdf: boolean;
  canManageMidi: boolean;
  onClose: (updatedFiles: ScoreFile[]) => void;
}

export function FileManageModal({
  orgSlug,
  score,
  parts,
  canManagePdf,
  canManageMidi,
  onClose,
}: FileManageModalProps) {
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
  const midiFiles = files.filter((f) => f.fileType === "midi");
  const otherFiles = files.filter((f) => f.fileType !== "full_score" && f.fileType !== "midi");

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
    if (!file) {
      setUploadError("ファイルを選択してください");
      return;
    }

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
  const accept =
    uploadType === "full_score"
      ? ".pdf"
      : uploadType === "midi"
        ? ".mid,.midi,.mp3"
        : ".pdf,.mp3,.wav";

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <FolderOpen size={15} className="text-brand-500 shrink-0" />
          ファイル管理
        </span>
      }
      description={score.title}
      onClose={() => onClose(files)}
      busy={uploading || deleting !== null}
      footer={
        (canManagePdf || canManageMidi) && (
          <div className="w-full space-y-3">
            <p className="text-xs font-semibold text-gray-600">ファイルを追加</p>
            {canManagePdf && fullScores.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                楽譜PDFは1つのみ登録できます。差し替える場合は既存ファイルを削除してから追加してください。
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={uploadType}
                onChange={(e) => {
                  setUploadType(e.target.value as "full_score" | "midi" | "other");
                  setUploadPartId("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
              >
                {canManagePdf && fullScores.length === 0 && (
                  <option value="full_score">楽譜 (PDF)</option>
                )}
                {canManageMidi && <option value="midi">MIDI</option>}
                {canManagePdf && <option value="other">その他</option>}
              </select>

              {needsPart && (
                <select
                  value={uploadPartId}
                  onChange={(e) => setUploadPartId(e.target.value)}
                  className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                >
                  <option value="">全体</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="file:text-brand-600 file:border-brand-200 hover:file:bg-brand-50 flex-1 cursor-pointer text-xs text-gray-600 file:mr-3 file:rounded-md file:border file:border-0 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium"
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="bg-brand-600 hover:bg-brand-700 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                追加
              </button>
            </div>

            <ErrorMessage>{uploadError}</ErrorMessage>
          </div>
        )
      }
    >
      <ErrorMessage>{deleteError}</ErrorMessage>
      <FileSection
        label="楽譜 (PDF)"
        fileList={fullScores}
        canDelete={canManagePdf}
        partMap={partMap}
        deleting={deleting}
        onDeleteClick={setConfirmTarget}
      />
      <FileSection
        label="MIDI"
        fileList={midiFiles}
        canDelete={canManageMidi}
        grouped
        partMap={partMap}
        deleting={deleting}
        onDeleteClick={setConfirmTarget}
      />
      <FileSection
        label="その他"
        fileList={otherFiles}
        canDelete={canManagePdf}
        partMap={partMap}
        deleting={deleting}
        onDeleteClick={setConfirmTarget}
      />

      {confirmTarget && (
        <Modal
          title="ファイルを削除しますか？"
          size="sm"
          onClose={() => setConfirmTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                削除する
              </button>
            </>
          }
        >
          <p className="text-sm break-all text-gray-500">{confirmTarget.fileName}</p>
        </Modal>
      )}
    </Modal>
  );
}
