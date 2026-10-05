"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { concertsApi, type ConcertStatus } from "@/lib/concerts-api";
import { concertKeys } from "@/lib/query-keys";
import { ConcertCard } from "./_components/ConcertCard";
import { PageBleedRow } from "@/components/PageBleedRow";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
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
    <PageWithHeader
      title="本番"
      badge={
        !loading ? <span className="text-sm text-gray-400">{sorted.length}件</span> : undefined
      }
      actions={
        roles.includes("admin") ? (
          <Link
            href={`/${org}/concerts/new`}
            prefetch={false}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            <Plus size={14} />
            演奏会を登録
          </Link>
        ) : undefined
      }
      toolbar={
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
      }
      loading={loading}
      mainClassName="space-y-3"
    >
      <ErrorMessage variant="section">
        {concertsError &&
          userErrorMessage(
            concertsError,
            "演奏会の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
      </ErrorMessage>

      {!concertsError && sorted.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <CalendarDays size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">演奏会が登録されていません</p>
        </div>
      )}

      {!concertsError &&
        sorted.map((concert) => <ConcertCard key={concert.id} concert={concert} org={org} />)}
    </PageWithHeader>
  );
}
