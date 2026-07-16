"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/lib/events-api";
import { monthStart } from "@/lib/date";
import { eventKeys } from "@/lib/query-keys";
import { Calendar } from "./_components/Calendar";
import { EventList } from "./_components/EventList";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { useMember } from "@/contexts/MemberContext";
import { canManageSchedule } from "@/lib/roles";

export default function SchedulePage() {
  const { org } = useParams<{ org: string }>();
  const today = new Date();

  const { roles } = useMember();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const from = monthStart(year, month);
  const to = month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);

  const {
    data: events = [],
    isLoading: loading,
    error: eventsError,
  } = useQuery({
    queryKey: eventKeys.list(org, year, month),
    queryFn: () => eventsApi.list(org, { from, to }),
  });

  const canCreateEvent = canManageSchedule(roles);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <h1 className="text-lg font-semibold text-gray-800">スケジュール</h1>
          {canCreateEvent && (
            <Link
              href={`/${org}/schedule/new`}
              prefetch={false}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              <Plus size={14} /> イベントを追加
            </Link>
          )}
        </PageBleedRow>
      </header>

      {loading && (
        <div className="flex flex-1 items-center justify-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      )}

      {!loading && eventsError && (
        <div className="m-8 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{eventsError.message}</span>
        </div>
      )}

      {!loading && !eventsError && (
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
