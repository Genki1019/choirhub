"use client";

import { useState } from "react";
import { Music2, ChevronUp, Play, Download } from "lucide-react";
import { Modal } from "@/components/Modal";
import { type ScoreDetail, type ScoreFile } from "@/lib/scores-api";
import { formatCreators } from "./CreatorLine";

const DEMO_AUDIO_URL = "/demo/test_midi.mp3";

function MidiFileRow({ file, splitLabel }: { file: ScoreFile; splitLabel?: string }) {
  const [open, setOpen] = useState(false);
  const src = file.downloadUrl ?? DEMO_AUDIO_URL;

  return (
    <div className="overflow-hidden rounded-lg bg-gray-50">
      <div className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-100">
        <Music2 size={14} className="shrink-0 text-purple-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-gray-700">{file.fileName}</p>
          {splitLabel && <p className="text-xs text-gray-400">{splitLabel}</p>}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? "閉じる" : "再生"}
          className="text-purple-400 transition-colors hover:text-purple-600"
        >
          {open ? <ChevronUp size={14} /> : <Play size={14} />}
        </button>
        <a
          href={src}
          download={file.fileName}
          title="ダウンロード"
          className="hover:text-brand-500 text-gray-400 opacity-0 transition-all group-hover:opacity-100"
        >
          <Download size={14} />
        </a>
      </div>
      {open && (
        <div className="px-3 pt-1 pb-3">
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
    }),
  );
  const sortedPartKeys = partKeys.sort((a, b) => {
    const fa = firstFilePerPart.get(a)!;
    const fb = firstFilePerPart.get(b)!;
    return (fa.partName ?? "").localeCompare(fb.partName ?? "", "ja");
  });

  const globalMidis = grouped.get(null) ?? [];

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Music2 size={16} className="shrink-0 text-purple-500" />
          <span className="truncate">{score.title}</span>
        </span>
      }
      description={formatCreators(score.composer, score.arranger) ?? undefined}
      onClose={onClose}
    >
      {midiFiles.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">MIDIファイルが登録されていません</p>
      )}
      {globalMidis.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">全体</p>
          <div className="space-y-1.5">
            {globalMidis.map((f) => (
              <MidiFileRow key={f.id} file={f} />
            ))}
          </div>
        </div>
      )}
      {sortedPartKeys.map((partId) => {
        const files = grouped.get(partId) ?? [];
        const partName = files[0]?.partName ?? "不明";
        return (
          <div key={partId}>
            <p className="mb-2 text-xs font-semibold text-gray-500">{partName}</p>
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
    </Modal>
  );
}
