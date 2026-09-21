"use client";

import { useRef } from "react";
import { Loader2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { scoresApi } from "@/lib/scores-api";
import { membersApi } from "@/lib/members-api";
import { scoresKeys, memberKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { canManageScorePdf, canManageScoreMidi } from "@/lib/roles";
import { FileManageModal } from "@/app/[org]/scores/_components/FileManageModal";

interface ScoreFilesModalProps {
  org: string;
  scoreId: string;
  onClose: () => void;
}

function ClosableOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="relative rounded-2xl bg-white px-8 py-6 shadow-xl">
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-3 right-3 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

/** 楽譜を選択した後、既存のFileManageModal（曲目詳細画面と同一実装）をそのまま表示する薄いラッパー */
export function ScoreFilesModal({ org, scoreId, onClose }: ScoreFilesModalProps) {
  const { roles } = useMember();

  const {
    data: score,
    isLoading,
    error,
  } = useQuery({
    queryKey: scoresKeys.detail(org, scoreId),
    queryFn: () => scoresApi.getDetail(org, scoreId),
  });
  const { data: parts = [] } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
  });

  if (error) {
    return (
      <ClosableOverlay onClose={onClose}>
        <p className="pr-4 text-sm text-red-500">楽譜の取得に失敗しました</p>
      </ClosableOverlay>
    );
  }

  if (isLoading || !score) {
    return (
      <ClosableOverlay onClose={onClose}>
        <div className="flex items-center gap-2 pr-4 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      </ClosableOverlay>
    );
  }

  return (
    <FileManageModal
      orgSlug={org}
      score={score}
      parts={parts}
      canManagePdf={canManageScorePdf(roles)}
      canManageMidi={canManageScoreMidi(roles)}
      onClose={onClose}
    />
  );
}
