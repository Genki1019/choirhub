"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, Loader2, CalendarDays, Mail } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { homeApi, type HomeData } from "@/lib/home-api";
import { homeKeys } from "@/lib/query-keys";
import { StatCard } from "./_components/StatCard";
import { EventCard } from "./_components/EventCard";
import { MonthlyOrganizerCard } from "./_components/MonthlyOrganizerCard";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

function daysUntil(isoString: string): number {
  const now = new Date();
  const target = new Date(isoString);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatMailDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function HomePage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: homeKeys.get(org),
    queryFn: () => homeApi.get(org),
  });

  const upcomingEvents = data?.upcomingEvents ?? [];
  const nextRehearsal = data?.nextRehearsal ?? null;
  const nextConcert = data?.nextConcert ?? null;

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <h1 className="text-lg font-semibold text-gray-800">ホーム</h1>
          {data && data.unansweredEventCount > 0 && (
            <Link
              href={`/${org}/schedule`}
              prefetch={false}
              className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100"
            >
              <AlertCircle size={13} />
              出欠未回答 {data.unansweredEventCount}件
            </Link>
          )}
        </PageBleedRow>
      </header>

      <PageMain className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {nextRehearsal ? (
                <StatCard
                  label="次回練習まで"
                  value={`${daysUntil(nextRehearsal.startsAt)}日`}
                  valueClass="text-teal-500"
                  sub={nextRehearsal.title}
                />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                  <p className="text-xs font-medium text-gray-400">次回練習まで</p>
                  <p className="mt-3 text-sm text-gray-300">予定なし</p>
                </div>
              )}

              {nextConcert ? (
                <StatCard
                  label="次回本番まで"
                  value={`${daysUntil(nextConcert.startsAt)}日`}
                  valueClass="text-orange-500"
                  sub={nextConcert.title}
                />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                  <p className="text-xs font-medium text-gray-400">次回本番まで</p>
                  <p className="mt-3 text-sm text-gray-300">予定なし</p>
                </div>
              )}

              <MonthlyOrganizerCard
                organizer={data?.monthlyOrganizer ?? null}
                isTicketManager={data?.isTicketManager ?? false}
                org={org}
                onSaved={(value) =>
                  queryClient.setQueryData<HomeData>(homeKeys.get(org), (prev) =>
                    prev ? { ...prev, monthlyOrganizer: value } : prev,
                  )
                }
              />
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                  <CalendarDays size={14} className="text-gray-400" />
                  直近の予定
                </h2>
                <Link
                  href={`/${org}/schedule`}
                  prefetch={false}
                  className="text-brand-600 text-xs hover:underline"
                >
                  すべて見る
                </Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">直近の予定はありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event.id} event={event} org={org} />
                  ))}
                </div>
              )}
            </section>

            {data && data.recentMails.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    最近のメール
                  </h2>
                  <Link
                    href={`/${org}/mailing`}
                    prefetch={false}
                    className="text-brand-600 text-xs hover:underline"
                  >
                    すべて見る
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                  {data.recentMails.map((mail) => (
                    <Link
                      key={mail.id}
                      href={`/${org}/mailing/${mail.id}`}
                      prefetch={false}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="bg-brand-100 text-brand-600 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold">
                        {mail.senderAvatarUrl ? (
                          <Image
                            src={mail.senderAvatarUrl}
                            alt={mail.senderName}
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          mail.senderName.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-gray-400">{mail.senderName}</p>
                        <p className="truncate text-sm text-gray-700">
                          {mail.subject || "（件名なし）"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatMailDate(mail.sentAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </PageMain>
    </div>
  );
}
