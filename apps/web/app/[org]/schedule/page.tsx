"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { eventsApi, type EventSummary } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import { Calendar } from "./_components/Calendar";
import { EventList } from "./_components/EventList";
import { PageMain } from "@/components/PageMain";

export default function SchedulePage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();
  const today   = new Date();

  const [events,  setEvents]  = useState<EventSummary[]>([]);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [year,    setYear]    = useState(today.getFullYear());
  const [month,   setMonth]   = useState(today.getMonth() + 1);

  useEffect(() => {
    Promise.all([eventsApi.list(org), membersApi.me(org)])
      .then(([evList, me]) => {
        setEvents(evList);
        setMyRoles(me.roles);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, router]);

  const canCreateEvent = myRoles.some((r) => ["admin", "tech", "conductor"].includes(r));

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">スケジュール</h1>
        {canCreateEvent && (
          <Link
            href={`/${org}/schedule/new`}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> イベントを追加
          </Link>
        )}
      </header>

      {loading && (
        <div className="flex items-center justify-center flex-1 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      )}

      {!loading && error && (
        <div className="m-8 flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <PageMain className="flex flex-col gap-6">
          <Calendar
            year={year}
            month={month}
            today={today}
            events={events}
            org={org}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
          <EventList events={events} year={year} month={month} org={org} />
        </PageMain>
      )}
    </div>
  );
}
