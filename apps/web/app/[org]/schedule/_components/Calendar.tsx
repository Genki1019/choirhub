"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventSummary, EventCategory, AttendanceStatus } from "@/lib/events-api";
import { getConcertHref } from "@/lib/routes";

function getCategoryColor(cat: EventCategory): string {
  return cat.color || "#8B5CF6";
}

const ATTENDANCE_STYLE: Record<AttendanceStatus, { symbol: string; text: string }> = {
  attending: { symbol: "○", text: "text-teal-600" },
  maybe: { symbol: "△", text: "text-orange-500" },
  absent: { symbol: "✕", text: "text-red-500" },
  undecided: { symbol: "—", text: "text-gray-400" },
};

// ── 日曜始まり定数 ────────────────────────────────────

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// ── ユーティリティ ────────────────────────────────────

// 日曜始まり: getDay() は 0=日 でそのまま列インデックスと一致するのでオフセット不要
function buildCalendarCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const total = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const day = i - firstDow + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

function eventsOnDay(events: EventSummary[], year: number, month: number, day: number) {
  return events.filter((e) => {
    const d = new Date(e.startsAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
  });
}

// ── コンポーネント ────────────────────────────────────

interface CalendarProps {
  year: number;
  month: number;
  today: Date;
  events: EventSummary[];
  org: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function Calendar({
  year,
  month,
  today,
  events,
  org,
  onPrevMonth,
  onNextMonth,
}: CalendarProps) {
  const cells = buildCalendarCells(year, month);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* 月ナビ */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <button
          onClick={onPrevMonth}
          aria-label="前の月"
          className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
        >
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
        <p className="font-semibold text-gray-800">
          {year}年 {month}月
        </p>
        <button
          onClick={onNextMonth}
          aria-label="次の月"
          className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
        >
          <ChevronRight size={18} className="text-gray-500" />
        </button>
      </div>

      {/* 曜日ヘッダー — 0=日(赤) / 6=土(青) */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={[
              "py-2 text-center text-xs font-medium",
              i === 0 ? "text-red-500" : i === 6 ? "text-brand-500" : "text-gray-400",
            ].join(" ")}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 日付セル */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dow = idx % 7; // 0=日, 6=土
          const isToday =
            day !== null &&
            year === today.getFullYear() &&
            month === today.getMonth() + 1 &&
            day === today.getDate();
          const dayEvents = day ? eventsOnDay(events, year, month, day) : [];

          return (
            <div
              key={idx}
              className={[
                "min-h-[64px] border-r border-b border-gray-100 p-1 last:border-r-0 sm:min-h-[72px] sm:p-1.5",
                !day ? "bg-gray-50" : "bg-white",
                dow === 0 && day ? "bg-red-50/30" : "",
                dow === 6 && day ? "bg-brand-50/20" : "",
              ].join(" ")}
            >
              {day !== null && (
                <>
                  <div className="mb-1 flex justify-end">
                    <span
                      className={[
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday
                          ? "bg-brand-600 text-white"
                          : dow === 0
                            ? "text-red-500"
                            : dow === 6
                              ? "text-brand-500"
                              : "text-gray-700",
                      ].join(" ")}
                    >
                      {day}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {dayEvents.map((ev) => {
                      const ss = ATTENDANCE_STYLE[ev.myAttendance];
                      const href = ev.concertId
                        ? getConcertHref(org, ev.concertId, "schedule")
                        : `/${org}/schedule/${ev.id}`;
                      return (
                        <Link
                          key={ev.id}
                          href={href}
                          prefetch={false}
                          className="flex items-center gap-0.5 rounded px-1 py-0.5 font-medium transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: `${getCategoryColor(ev.category)}20`,
                            color: getCategoryColor(ev.category),
                          }}
                        >
                          <span className="flex-1 truncate text-[8px] sm:text-[10px]">
                            {ev.title}
                          </span>
                          <span className={`hidden shrink-0 font-bold sm:inline ${ss.text}`}>
                            {ss.symbol}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
