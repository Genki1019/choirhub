"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, CalendarPlus } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/lib/events-api";
import { jstParts, monthEnd, monthStart } from "@/lib/date";
import { eventKeys } from "@/lib/query-keys";
import { Calendar } from "./_components/Calendar";
import { EventList } from "./_components/EventList";
import { CalendarFeedModal } from "./_components/CalendarFeedModal";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
import { useMember } from "@/contexts/MemberContext";
import { canManageSchedule } from "@/lib/roles";

export default function SchedulePage() {
  const { org } = useParams<{ org: string }>();
  const today = new Date();

  const { roles } = useMember();
  const [year, setYear] = useState(jstParts(today).year);
  const [month, setMonth] = useState(jstParts(today).month);
  const [showCalendarFeedModal, setShowCalendarFeedModal] = useState(false);

  const from = monthStart(year, month);
  const to = monthEnd(year, month);

  const {
    data,
    isLoading: loading,
    isPlaceholderData,
    error: eventsError,
  } = useQuery({
    queryKey: eventKeys.list(org, year, month),
    queryFn: () => eventsApi.list(org, { from, to }),
    placeholderData: keepPreviousData,
  });
  const events = isPlaceholderData ? [] : (data ?? []);

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
    <>
      <PageWithHeader
        title="スケジュール"
        loading={loading}
        mainClassName="flex flex-col gap-6"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCalendarFeedModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <CalendarPlus size={14} /> 外部カレンダーに連携
            </button>
            {canCreateEvent && (
              <Link
                href={`/${org}/schedule/new`}
                prefetch={false}
                className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
              >
                <Plus size={14} /> イベントを追加
              </Link>
            )}
          </div>
        }
      >
        <Calendar
          year={year}
          month={month}
          today={today}
          events={events}
          org={org}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
        />
        {eventsError ? (
          <ErrorMessage variant="section" autoScroll={false}>
            {userErrorMessage(
              eventsError,
              "予定の読み込みに失敗しました。ページを再読み込みしてください。",
            )}
          </ErrorMessage>
        ) : isPlaceholderData ? (
          <p className="py-6 text-center text-sm text-gray-400">読み込み中...</p>
        ) : (
          <EventList events={events} year={year} month={month} org={org} />
        )}
      </PageWithHeader>

      {showCalendarFeedModal && (
        <CalendarFeedModal orgSlug={org} onClose={() => setShowCalendarFeedModal(false)} />
      )}
    </>
  );
}
