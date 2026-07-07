"use client";

import { useState, useEffect, useRef } from "react";
import { Music2, X, ChevronUp, Play, Download } from "lucide-react";
import { type ScoreDetail, type ScoreFile } from "@/lib/scores-api";
import { CreatorLine } from "./CreatorLine";

const DEMO_AUDIO_URL = "/demo/test_midi.mp3";

function MidiFileRow({ file, splitLabel }: { file: ScoreFile; splitLabel?: string }) {
  const [open, setOpen] = useState(false);
  const src = file.downloadUrl ?? DEMO_AUDIO_URL;

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 transition-colors group">
        <Music2 size={14} className="text-purple-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 truncate">{file.fileName}</p>
          {splitLabel && <p className="text-xs text-gray-400">{splitLabel}</p>}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? "閉じる" : "再生"}
          className="text-purple-400 hover:text-purple-600 transition-colors"
        >
          {open ? <ChevronUp size={14} /> : <Play size={14} />}
        </button>
        <a
          href={src}
          download={file.fileName}
          title="ダウンロード"
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-500 transition-all"
        >
          <Download size={14} />
        </a>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1">
          <audio controls src={src} className="w-full" />
        </div>
      )}
    </div>
  );
}

interface MidiModalProps {
  score: ScoreDetail;
  onClose: () => void;
}

export function MidiModal({ score, onClose }: MidiModalProps) {
  const midiFiles = score.files.filter((f) => f.fileType === "midi");

  const grouped = new Map<string | null, ScoreFile[]>();
  grouped.set(null, []);
  midiFiles.forEach((f) => {
    const key = f.partId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  });

  const partKeys = Array.from(grouped.keys()).filter((k) => k !== null) as string[];
  const firstFilePerPart = new Map(
    partKeys.map((partId) => {
      const f = grouped.get(partId)![0];
      return [partId, f];
    })
  );
  const sortedPartKeys = partKeys.sort((a, b) => {
    const fa = firstFilePerPart.get(a)!;
    const fb = firstFilePerPart.get(b)!;
    return (fa.partName ?? "").localeCompare(fb.partName ?? "", "ja");
  });

  const globalMidis = grouped.get(null) ?? [];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={containerRef} className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <Music2 size={16} className="text-purple-500 shrink-0" />
              <h2 className="font-semibold text-gray-800 text-sm leading-snug truncate">
                {score.title}
              </h2>
            </div>
            <CreatorLine composer={score.composer} arranger={score.arranger} />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {midiFiles.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">MIDIファイルが登録されていません</p>
          )}
          {globalMidis.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">全体</p>
              <div className="space-y-1.5">
                {globalMidis.map((f) => <MidiFileRow key={f.id} file={f} />)}
              </div>
            </div>
          )}
          {sortedPartKeys.map((partId) => {
            const files = grouped.get(partId) ?? [];
            const partName = files[0]?.partName ?? "不明";
            return (
              <div key={partId}>
                <p className="text-xs font-semibold text-gray-500 mb-2">{partName}</p>
                <div className="space-y-1.5">
                  {files.map((f, idx) => (
                    <MidiFileRow
                      key={f.id}
                      file={f}
                      splitLabel={files.length > 1 ? `${idx + 1}/${files.length}` : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
