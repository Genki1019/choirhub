"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { scoresApi } from "@/lib/scores-api";
import { concertsApi } from "@/lib/concerts-api";
import { eventsApi } from "@/lib/events-api";
import { scoresKeys, concertKeys, eventKeys } from "@/lib/query-keys";
import type { CrossFileKind } from "@/lib/files-api";

interface PickerItem {
  id: string;
  title: string;
  subtitle: string | null;
}

interface ResourcePickerModalProps {
  org: string;
  kind: CrossFileKind;
  onClose: () => void;
  onSelect: (resource: { id: string; title: string }) => void;
}

const KIND_LABEL: Record<CrossFileKind, string> = {
  score: "楽譜",
  concert: "本番",
  event: "イベント",
};

export function ResourcePickerModal({ org, kind, onClose, onSelect }: ResourcePickerModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 楽譜: サーバー側のタイトル検索API（scoresApi.list）を使う
  const scoreQuery = useQuery({
    queryKey: scoresKeys.list(org, debouncedSearch),
    queryFn: () => scoresApi.list(org, { q: debouncedSearch }),
    enabled: kind === "score",
  });

  // 本番・イベント: 横断検索APIが無いため全件取得しクライアント側でタイトルフィルタする
  const concertQuery = useQuery({
    queryKey: concertKeys.list(org),
    queryFn: () => concertsApi.list(org),
    enabled: kind === "concert",
  });
  const eventQuery = useQuery({
    queryKey: eventKeys.all(org),
    queryFn: () => eventsApi.list(org),
    enabled: kind === "event",
  });

  let items: PickerItem[] = [];
  let isLoading = false;
  if (kind === "score") {
    // isFetchingだと同じ検索語に戻った際キャッシュ済み結果が再フェッチのたびに一瞬消えるため、
    // 初回未取得時のみtrueになるisLoadingを使う（concert/eventの分岐と挙動を揃える）
    isLoading = scoreQuery.isLoading;
    items = (scoreQuery.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: [s.composer && `${s.composer} 作曲`, s.arranger && `${s.arranger} 編曲`]
        .filter(Boolean)
        .join(" / "),
    }));
  } else if (kind === "concert") {
    isLoading = concertQuery.isLoading;
    items = (concertQuery.data ?? [])
      .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
      .map((c) => ({ id: c.id, title: c.title, subtitle: c.heldOn }));
  } else {
    isLoading = eventQuery.isLoading;
    items = (eventQuery.data ?? [])
      .filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
      .map((e) => ({ id: e.id, title: e.title, subtitle: e.startsAt.slice(0, 10) }));
  }

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
          <h2 className="text-base font-semibold text-gray-800">{KIND_LABEL[kind]}を選択</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${KIND_LABEL[kind]}を検索...`}
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            autoFocus
          />
          <div className="max-h-80 overflow-hidden overflow-y-auto rounded-lg border border-gray-200">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">読み込み中...</span>
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400">見つかりません</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect({ id: item.id, title: item.title })}
                  className="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  {item.subtitle && <p className="mt-0.5 text-xs text-gray-400">{item.subtitle}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
