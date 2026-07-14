"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { concertsApi, type ConcertStatus } from "@/lib/concerts-api";
import { concertKeys } from "@/lib/query-keys";
import { ConcertCard } from "./_components/ConcertCard";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { useMember } from "@/contexts/MemberContext";

type Filter = "all" | ConcertStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "survey_open", label: "調査中" },
  { value: "confirmed", label: "確定済み" },
  { value: "draft", label: "準備中" },
  { value: "past", label: "終了" },
];

export default function ConcertsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const [filter, setFilter] = useState<Filter>("all");

  const {
    data: concerts = [],
    isLoading: loading,
    error: concertsError,
  } = useQuery({
    queryKey: concertKeys.list(org),
    queryFn: () => concertsApi.list(org),
  });

  const sorted = useMemo(() => {
    const f = filter === "all" ? concerts : concerts.filter((c) => c.status === filter);
    return [...f.filter((c) => c.status !== "past"), ...f.filter((c) => c.status === "past")];
  }, [concerts, filter]);

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800">本番</h1>
            {!loading && <span className="text-sm text-gray-400">{sorted.length}件</span>}
          </div>
          {roles.includes("admin") && (
            <Link
              href={`/${org}/concerts/new`}
              prefetch={false}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              <Plus size={14} />
              演奏会を登録
            </Link>
          )}
        </PageBleedRow>
      </header>

      {/* フィルタ */}
      <div className="shrink-0 border-b border-gray-100 bg-white">
        <PageBleedRow className="flex gap-1 py-3">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === value ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </PageBleedRow>
      </div>

      <PageMain className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && concertsError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
            <AlertCircle size={16} />
            <span className="text-sm">{concertsError.message}</span>
          </div>
        )}

        {!loading && !concertsError && sorted.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <CalendarDays size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">演奏会が登録されていません</p>
          </div>
        )}

        {!loading &&
          !concertsError &&
          sorted.map((concert) => <ConcertCard key={concert.id} concert={concert} org={org} />)}
      </PageMain>
    </div>
  );
}
