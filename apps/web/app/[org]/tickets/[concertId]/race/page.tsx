"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Users, User, Globe, EyeOff, Settings } from "lucide-react";
import { ticketsApi, type RaceData } from "@/lib/tickets-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/lib/query-keys";
import { PartCard } from "./_components/PartCard";
import { IndividualTable } from "./_components/IndividualTable";
import { ScoringRules } from "./_components/ScoringRules";
import { ScoringSettingsModal } from "./_components/ScoringSettingsModal";
import { PageBleedRow } from "@/components/PageBleedRow";
import { PageHeader } from "@/components/PageHeader";
import { PageErrorState } from "@/components/PageErrorState";
import { userErrorMessage } from "@/lib/api-client";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function RacePage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"parts" | "individuals">("parts");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);

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

  if (!data) {
    return (
      <PageErrorState
        title="チケットレース"
        backHref={`/${org}/tickets`}
        message={
          error
            ? userErrorMessage(error, "読み込みに失敗しました。ページを再読み込みしてください。")
            : "データが見つかりません"
        }
      />
    );
  }

  const backHref = data.isTicketManager
    ? `/${org}/tickets/${concertId}`
    : `/${org}/tickets/${concertId}/my`;

  if (data.individuals.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="チケットレース" backHref={backHref} />
        <ErrorMessage className="mx-4 mt-6 sm:mx-8" autoScroll={false}>
          {error &&
            userErrorMessage(
              error,
              "最新のレース結果の読み込みに失敗しました。ページを再読み込みしてください。",
            )}
        </ErrorMessage>
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
          setPublishError(null);
          try {
            await ticketsApi.unpublishRace(org, concertId);
            queryClient.setQueryData<RaceData>(ticketKeys.race(org, concertId), (prev) =>
              prev ? { ...prev, racePublishedAt: null } : prev,
            );
          } catch (err) {
            setPublishError(
              userErrorMessage(err, "公開の取り消しに失敗しました。もう一度お試しください。"),
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
          setPublishError(null);
          try {
            const result = await ticketsApi.publishRace(org, concertId);
            queryClient.setQueryData<RaceData>(ticketKeys.race(org, concertId), (prev) =>
              prev ? { ...prev, racePublishedAt: result.racePublishedAt } : prev,
            );
          } catch (err) {
            setPublishError(userErrorMessage(err, "公開に失敗しました。もう一度お試しください。"));
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

  const scoringSettingsButton = data.isTicketManager && (
    <button
      onClick={() => setShowScoringModal(true)}
      disabled={!!data.racePublishedAt}
      title={data.racePublishedAt ? "レース公開後は変更できません" : undefined}
      className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40"
    >
      <Settings size={13} />
      採点設定
    </button>
  );

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
        actions={
          <div className="flex items-center gap-2">
            {scoringSettingsButton}
            {publishAction}
          </div>
        }
      >
        {publishedBanner}
        {tabsRow}
      </PageHeader>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6 sm:px-8">
        <ErrorMessage autoScroll={false}>
          {error &&
            userErrorMessage(
              error,
              "最新のレース結果の読み込みに失敗しました。ページを再読み込みしてください。",
            )}
        </ErrorMessage>
        <ErrorMessage>{publishError}</ErrorMessage>
        <ScoringRules scoring={data.scoring} />

        {tab === "parts" ? (
          <div className="space-y-3">
            {data.parts.map((p) => (
              <PartCard
                key={p.partId}
                part={p}
                scoring={data.scoring}
                isTicketManager={data.isTicketManager}
                org={org}
                concertId={concertId}
                onOrganizerPeriodSaved={(partId, period) => {
                  queryClient.setQueryData<RaceData>(ticketKeys.race(org, concertId), (prev) =>
                    prev
                      ? {
                          ...prev,
                          parts: prev.parts.map((part) =>
                            part.partId === partId ? { ...part, organizerPeriod: period } : part,
                          ),
                        }
                      : prev,
                  );
                }}
              />
            ))}
          </div>
        ) : (
          <IndividualTable individuals={data.individuals} />
        )}
      </main>

      {showScoringModal && (
        <ScoringSettingsModal
          initialScoring={data.scoring}
          onClose={() => setShowScoringModal(false)}
          onSubmit={async (config) => {
            await ticketsApi.updateScoringConfig(org, concertId, config);
            // 配点変更はパートごとのbreakdown/totalPointsの再計算を伴うため、部分パッチではなく再取得する
            await queryClient.invalidateQueries({ queryKey: ticketKeys.race(org, concertId) });
            setShowScoringModal(false);
          }}
        />
      )}
    </div>
  );
}
