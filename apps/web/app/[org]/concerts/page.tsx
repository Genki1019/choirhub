"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus, Loader2, AlertCircle } from "lucide-react";
import { concertsApi, type ConcertSummary, type ConcertStatus } from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";
import { membersApi } from "@/lib/members-api";
import { ConcertCard } from "./_components/ConcertCard";

type Filter = "all" | ConcertStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",         label: "すべて" },
  { value: "survey_open", label: "調査中" },
  { value: "confirmed",   label: "確定済み" },
  { value: "draft",       label: "準備中" },
  { value: "past",        label: "終了" },
];

export default function ConcertsPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();

  const [concerts, setConcerts] = useState<ConcertSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    Promise.all([
      concertsApi.list(org),
      membersApi.me(org),
    ])
      .then(([data, me]) => {
        setConcerts(data);
        setIsAdmin(me.roles.includes("admin"));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, router]);

  const filtered = filter === "all" ? concerts : concerts.filter((c) => c.status === filter);

  // 終了以外を先に、その中で日付昇順。終了は最後
  const sorted = [
    ...filtered.filter((c) => c.status !== "past"),
    ...filtered.filter((c) => c.status === "past"),
  ];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-800">本番</h1>
          {!loading && <span className="text-sm text-gray-400">{sorted.length}件</span>}
        </div>
        {isAdmin && (
          <Link
            href={`/${org}/concerts/new`}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            演奏会を登録
          </Link>
        )}
      </header>

      {/* フィルタ */}
      <div className="px-8 py-3 bg-white border-b border-gray-100 flex gap-1 shrink-0">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === value ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 sm:px-8 py-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">演奏会が登録されていません</p>
          </div>
        )}

        {!loading && !error && sorted.map((concert) => (
          <ConcertCard key={concert.id} concert={concert} org={org} />
        ))}
      </main>

    </div>
  );
}
