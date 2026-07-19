"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Trophy, Lock, MapPin } from "lucide-react";
import { ticketsApi, type MyAllocationConcert, type MyAllocationBatch } from "@/lib/tickets-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketKeys } from "@/lib/query-keys";
import { BatchCard } from "./_components/BatchCard";
import { OutreachCountCard } from "./_components/OutreachCountCard";
import { PageHeader } from "@/components/PageHeader";

export default function MyTicketPage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const queryClient = useQueryClient();

  const {
    data: myList,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ticketKeys.myList(org),
    queryFn: () => ticketsApi.myList(org),
  });

  const concert = myList?.find((c) => c.concertId === concertId) ?? null;

  const handleBatchUpdated = (batchId: string, data: Partial<MyAllocationBatch>) => {
    queryClient.setQueryData<MyAllocationConcert[]>(ticketKeys.myList(org), (prev) =>
      prev
        ? prev.map((c) =>
            c.concertId === concertId
              ? {
                  ...c,
                  batches: c.batches.map((b) => (b.batchId === batchId ? { ...b, ...data } : b)),
                }
              : c,
          )
        : prev,
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !concert) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{error?.message ?? "チケット情報が見つかりません"}</span>
        </div>
      </div>
    );
  }

  const date = new Date(concert.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const isClosed = !!concert.ticketInputClosedAt;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={concert.title}
        subtitle={<span className="text-sm text-gray-400">{dateStr}</span>}
        backHref={`/${org}/tickets`}
      />

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-6 py-6">
        {isClosed && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <Lock size={14} className="shrink-0" />
            <span>
              チケット入力は締め切られました（
              {new Date(concert.ticketInputClosedAt!).toLocaleDateString("ja-JP")}）
            </span>
          </div>
        )}

        {concert.racePublishedAt && (
          <Link
            href={`/${org}/tickets/${concertId}/race`}
            prefetch={false}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
          >
            <Trophy size={16} className="shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">
                チケットレース結果が公開されました
              </p>
              <p className="text-xs text-amber-600">タップして結果を見る</p>
            </div>
          </Link>
        )}

        {concert.batches.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-sm">配布登録されていません</p>
            <p className="mt-1 text-xs">チケット担当者にお問い合わせください</p>
          </div>
        ) : (
          <>
            {concert.batches.map((batch) => (
              <BatchCard
                key={batch.batchId}
                batch={batch}
                orgSlug={org}
                concertId={concertId}
                isClosed={isClosed}
                onChange={(data) => handleBatchUpdated(batch.batchId, data)}
              />
            ))}

            <Link
              href={`/${org}/tickets/${concertId}/outreach`}
              prefetch={false}
              className="bg-brand-50 border-brand-200 hover:bg-brand-100 flex items-center gap-3 rounded-2xl border px-5 py-3.5 transition-colors"
            >
              <MapPin size={16} className="text-brand-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-brand-800 text-sm font-semibold">情宣活動の申請・確認</p>
                <p className="text-brand-600 text-xs">行き先・参加者・交通費・販売枚数を記録</p>
              </div>
              <ArrowLeft size={14} className="text-brand-400 rotate-180" />
            </Link>

            {concert.batches[0] && (
              <OutreachCountCard
                orgSlug={org}
                allocationId={concert.batches[0].allocationId}
                initialCount={concert.batches[0].outreachCount}
                isClosed={isClosed}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
