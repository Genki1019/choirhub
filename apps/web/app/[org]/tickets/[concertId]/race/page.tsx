"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, Users, User, Globe, EyeOff } from "lucide-react";
import { ticketsApi, type RaceData } from "@/lib/tickets-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/lib/query-keys";
import { PartCard } from "./_components/PartCard";
import { IndividualTable } from "./_components/IndividualTable";
import { ScoringRules } from "./_components/ScoringRules";
import { PageBleedRow } from "@/components/PageBleedRow";
import { PageHeader } from "@/components/PageHeader";

export default function RacePage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"parts" | "individuals">("parts");
  const [publishing, setPublishing] = useState(false);

  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ticketKeys.race(org, concertId),
    queryFn: () => ticketsApi.race(org, concertId),
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{error?.message ?? "データが見つかりません"}</span>
        </div>
      </div>
    );
  }

  const backHref = data.isTicketManager
    ? `/${org}/tickets/${concertId}`
    : `/${org}/tickets/${concertId}/my`;

  if (data.individuals.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="チケットレース" backHref={backHref} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">まだ配布・販売データがありません</p>
        </div>
      </div>
    );
  }

  const publishAction = data.isTicketManager ? (
    data.racePublishedAt ? (
      <button
        onClick={async () => {
          setPublishing(true);
          try {
            await ticketsApi.unpublishRace(org, concertId);
            queryClient.setQueryData<RaceData>(ticketKeys.race(org, concertId), (prev) =>
              prev ? { ...prev, racePublishedAt: null } : prev,
            );
          } finally {
            setPublishing(false);
          }
        }}
        disabled={publishing}
        className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-60"
      >
        {publishing ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
        公開取消
      </button>
    ) : (
      <button
        onClick={async () => {
          setPublishing(true);
          try {
            const result = await ticketsApi.publishRace(org, concertId);
            queryClient.setQueryData<RaceData>(ticketKeys.race(org, concertId), (prev) =>
              prev ? { ...prev, racePublishedAt: result.racePublishedAt } : prev,
            );
          } finally {
            setPublishing(false);
          }
        }}
        disabled={publishing}
        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
      >
        {publishing ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
        全体に公開
      </button>
    )
  ) : undefined;

  const publishedBanner = data.racePublishedAt && (
    <PageBleedRow className="pb-2">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <Globe size={12} />
        {new Date(data.racePublishedAt).toLocaleDateString("ja-JP")} に全団員へ公開済み
      </div>
    </PageBleedRow>
  );

  const tabsRow = (
    <PageBleedRow className="flex pt-1">
      {[
        { key: "parts" as const, label: "パート順位", icon: Users },
        { key: "individuals" as const, label: "個人順位", icon: User },
      ].map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={[
            "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
            tab === key
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </PageBleedRow>
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="チケットレース"
        subtitle={<span className="text-sm text-gray-400">{data.concert.title}</span>}
        backHref={backHref}
        actions={publishAction}
      >
        {publishedBanner}
        {tabsRow}
      </PageHeader>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6 sm:px-8">
        <ScoringRules scoring={data.scoring} />

        {tab === "parts" ? (
          <div className="space-y-3">
            {data.parts.map((p) => (
              <PartCard key={p.partId} part={p} scoring={data.scoring} />
            ))}
          </div>
        ) : (
          <IndividualTable individuals={data.individuals} />
        )}
      </main>
    </div>
  );
}
