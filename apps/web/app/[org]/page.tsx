"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, Loader2, CalendarDays, Mail } from "lucide-react";
import { homeApi, type HomeData } from "@/lib/home-api";
import { ApiClientError } from "@/lib/api-client";
import { StatCard } from "./_components/StatCard";
import { EventCard } from "./_components/EventCard";
import { MonthlyOrganizerCard } from "./_components/MonthlyOrganizerCard";
import { PageMain } from "@/components/PageMain";

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
  const router  = useRouter();

  const [data,    setData]    = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    homeApi.get(org)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [org, router]);

  const upcomingEvents = data?.upcomingEvents ?? [];
  const nextRehearsal  = data?.nextRehearsal  ?? null;
  const nextConcert    = data?.nextConcert    ?? null;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">ホーム</h1>
        {data && data.unansweredEventCount > 0 && (
          <Link
            href={`/${org}/schedule`}
            className="flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-medium px-3 py-1.5 rounded-full border border-orange-200 hover:bg-orange-100 transition-colors"
          >
            <AlertCircle size={13} />
            出欠未回答 {data.unansweredEventCount}件
          </Link>
        )}
      </header>

      <PageMain className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {nextRehearsal ? (
                <StatCard
                  label="次回練習まで"
                  value={`${daysUntil(nextRehearsal.startsAt)}日`}
                  valueClass="text-teal-500"
                  sub={nextRehearsal.title}
                />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <p className="text-xs text-gray-400 font-medium">次回練習まで</p>
                  <p className="text-sm text-gray-300 mt-3">予定なし</p>
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
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <p className="text-xs text-gray-400 font-medium">次回本番まで</p>
                  <p className="text-sm text-gray-300 mt-3">予定なし</p>
                </div>
              )}

              <MonthlyOrganizerCard
                organizer={data?.monthlyOrganizer ?? null}
                isTicketManager={data?.isTicketManager ?? false}
                org={org}
                onSaved={(value) => setData((prev) => prev ? { ...prev, monthlyOrganizer: value } : prev)}
              />
            </div>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-gray-400" />
                  直近の予定
                </h2>
                <Link href={`/${org}/schedule`} className="text-xs text-blue-600 hover:underline">
                  すべて見る
                </Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center">
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
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                    <Mail size={14} className="text-gray-400" />
                    最近のメール
                  </h2>
                  <Link href={`/${org}/mailing`} className="text-xs text-blue-600 hover:underline">
                    すべて見る
                  </Link>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {data.recentMails.map((mail) => (
                    <Link
                      key={mail.id}
                      href={`/${org}/mailing/${mail.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 text-blue-600 font-semibold text-xs flex items-center justify-center shrink-0">
                        {mail.senderAvatarUrl ? (
                          <Image src={mail.senderAvatarUrl} alt={mail.senderName} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                        ) : (
                          mail.senderName.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 truncate">{mail.senderName}</p>
                        <p className="text-sm text-gray-700 truncate">{mail.subject || "（件名なし）"}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{formatMailDate(mail.sentAt)}</span>
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
