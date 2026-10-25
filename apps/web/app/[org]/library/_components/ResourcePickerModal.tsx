"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { scoresApi, type ScoreDetail } from "@/lib/scores-api";
import { concertsApi } from "@/lib/concerts-api";
import { eventsApi } from "@/lib/events-api";
import { scoresKeys, concertKeys, eventKeys } from "@/lib/query-keys";
import type { CrossFileKind } from "@/lib/files-api";
import { formatJaDate } from "@/lib/date";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

interface PickerItem {
  id: string;
  title: string;
  subtitle: string | null;
}

export interface PickedResource {
  id: string;
  title: string;
  score?: ScoreDetail;
}

interface ResourcePickerModalProps {
  org: string;
  kind: CrossFileKind;
  onClose: () => void;
  onSelect: (resource: PickedResource) => void;
}

const KIND_LABEL: Record<CrossFileKind, string> = {
  score: "楽譜",
  concert: "本番",
  event: "イベント",
};

export function ResourcePickerModal({ org, kind, onClose, onSelect }: ResourcePickerModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const latestRequest = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      .map((c) => ({ id: c.id, title: c.title, subtitle: formatJaDate(c.heldOn) }));
  } else {
    isLoading = eventQuery.isLoading;
    items = (eventQuery.data ?? [])
      .filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
      .map((e) => ({ id: e.id, title: e.title, subtitle: formatJaDate(e.startsAt) }));
  }

  const handleSelect = async (item: PickerItem) => {
    if (kind !== "score") {
      onSelect({ id: item.id, title: item.title });
      return;
    }
    // 楽譜はファイル一覧を含む詳細を読み込んでから開く。最後に押した行以外の応答と、閉じたあとの応答は捨てる
    latestRequest.current = item.id;
    setPendingId(item.id);
    setSelectError(null);
    try {
      const score = await queryClient.fetchQuery({
        queryKey: scoresKeys.detail(org, item.id),
        queryFn: () => scoresApi.getDetail(org, item.id),
        staleTime: 0,
      });
      if (!mounted.current || latestRequest.current !== item.id) return;
      onSelect({ id: item.id, title: item.title, score });
    } catch (err) {
      if (!mounted.current || latestRequest.current !== item.id) return;
      setSelectError(
        userErrorMessage(err, "楽譜の読み込みに失敗しました。もう一度お試しください。"),
      );
    } finally {
      if (mounted.current && latestRequest.current === item.id) setPendingId(null);
    }
  };

  return (
    <Modal title={`${KIND_LABEL[kind]}を選択`} onClose={onClose}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={`${KIND_LABEL[kind]}を検索`}
        placeholder={`${KIND_LABEL[kind]}を検索...`}
        className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        autoFocus
      />
      <ErrorMessage>{selectError}</ErrorMessage>
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
              onClick={() => handleSelect(item)}
              aria-busy={pendingId === item.id}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800">{item.title}</span>
                {item.subtitle && (
                  <span className="mt-0.5 block text-xs text-gray-400">{item.subtitle}</span>
                )}
              </span>
              {pendingId === item.id && (
                <Loader2 size={14} className="shrink-0 animate-spin text-gray-400" />
              )}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
