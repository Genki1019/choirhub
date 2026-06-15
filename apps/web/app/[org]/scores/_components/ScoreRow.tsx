"use client";

import { useState, useRef } from "react";
import {
  FileText, Music2, BookOpen, Tag, Pencil, EyeOff,
  Users, FolderOpen, Loader2,
} from "lucide-react";
import { scoresApi, type ScoreSummary } from "@/lib/scores-api";
import { CreatorLine } from "./CreatorLine";

interface ScoreRowProps {
  score: ScoreSummary;
  orgSlug: string;
  onMidiClick: (s: ScoreSummary) => void;
  onPurchaseClick?: (s: ScoreSummary) => void;
  onFileManage?: (s: ScoreSummary) => void;
  isPrivileged: boolean;
  isFileManager: boolean;
  canViewPrice: boolean;
  canSetPrice: boolean;
  onPriceUpdate: (id: string, price: number | null) => void;
}

export function ScoreRow({
  score, orgSlug, onMidiClick, onPurchaseClick, onFileManage,
  isPrivileged, isFileManager, canViewPrice, canSetPrice, onPriceUpdate,
}: ScoreRowProps) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const savingPriceRef = useRef(false);

  const startEditPrice = () => {
    setPriceInput(score.distributionPrice !== null ? String(score.distributionPrice) : "");
    setEditingPrice(true);
  };

  const savePrice = async () => {
    if (savingPriceRef.current) return;
    const trimmed = priceInput.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) { setEditingPrice(false); return; }
    if (parsed === score.distributionPrice) { setEditingPrice(false); return; }
    savingPriceRef.current = true;
    setSavingPrice(true);
    try {
      await scoresApi.setPrice(orgSlug, score.id, parsed);
      onPriceUpdate(score.id, parsed);
      setEditingPrice(false);
    } catch {
      setEditingPrice(false);
    } finally {
      savingPriceRef.current = false;
      setSavingPrice(false);
    }
  };

  const scoreFile = score.files.find((f) => f.fileType === "full_score");
  const midiCount = score.files.filter((f) => f.fileType === "midi").length;
  const restricted = !score.canAccessFiles;

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <BookOpen size={15} className="mt-0.5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug">{score.title}</p>
          <CreatorLine composer={score.composer} arranger={score.arranger} />

          {(canViewPrice || canSetPrice) && (
            <div className="mt-1">
              {editingPrice ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">¥</span>
                  <input
                    type="number"
                    min="0"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePrice();
                      if (e.key === "Escape") setEditingPrice(false);
                    }}
                    onBlur={savePrice}
                    className="w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    autoFocus
                    placeholder="例: 300"
                  />
                  {savingPrice && <Loader2 size={11} className="animate-spin text-gray-400" />}
                </div>
              ) : score.distributionPrice !== null ? (
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <Tag size={10} />
                    ¥{score.distributionPrice.toLocaleString()}
                  </span>
                  {canSetPrice && (
                    <button
                      onClick={startEditPrice}
                      className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors rounded"
                      title="価格を変更"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </div>
              ) : canSetPrice ? (
                <button
                  onClick={startEditPrice}
                  className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                >
                  + 価格を設定
                </button>
              ) : null}
            </div>
          )}

          {restricted ? (
            <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <EyeOff size={10} />
              {score.accessLevel === "secret" ? "閲覧制限されています" : "楽譜を購入すると閲覧できます"}
            </p>
          ) : (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {scoreFile ? (
                <a
                  href={`/${orgSlug}/scores/${score.id}/files/${scoreFile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={scoreFile.fileName}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors font-medium"
                >
                  <FileText size={11} />
                  楽譜
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-400 border border-gray-200 font-medium">
                  <FileText size={11} />
                  楽譜未登録
                </span>
              )}

              {score.canDownload && (
                midiCount > 0 ? (
                  <button
                    onClick={() => onMidiClick(score)}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors font-medium"
                  >
                    <Music2 size={11} />
                    MIDI <span className="text-purple-400 font-normal">{midiCount}件</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-400 border border-gray-200 font-medium">
                    <Music2 size={11} />
                    MIDI未登録
                  </span>
                )
              )}

              {isPrivileged && onPurchaseClick && (
                <button
                  onClick={() => onPurchaseClick(score)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors font-medium ml-auto"
                >
                  <Users size={11} />
                  購入者を記録
                </button>
              )}
              {isFileManager && onFileManage && (
                <button
                  onClick={() => onFileManage(score)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors font-medium"
                >
                  <FolderOpen size={11} />
                  ファイル管理
                </button>
              )}
            </div>
          )}

          {restricted && (isPrivileged || isFileManager) && (
            <div className="flex items-center gap-2 mt-2.5">
              <p className="text-xs text-gray-400 flex-1">購入者未登録</p>
              {isPrivileged && onPurchaseClick && (
                <button
                  onClick={() => onPurchaseClick(score)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors font-medium"
                >
                  <Users size={11} />
                  購入者を記録
                </button>
              )}
              {isFileManager && onFileManage && (
                <button
                  onClick={() => onFileManage(score)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors font-medium"
                >
                  <FolderOpen size={11} />
                  ファイル管理
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
