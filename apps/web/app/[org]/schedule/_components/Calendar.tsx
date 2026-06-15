"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventSummary, EventCategory, AttendanceStatus } from "@/lib/events-api";

// ── スラグベースのスタイル（システム標準区分） ──────────

const SLUG_STYLE: Record<string, { dot: string; badge: string }> = {
  rehearsal: { dot: "bg-teal-400",   badge: "bg-teal-100 text-teal-700"    },
  concert:   { dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700" },
  meeting:   { dot: "bg-blue-400",   badge: "bg-blue-100 text-blue-700"    },
  other:     { dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600"    },
};

export function getCategoryStyle(cat: EventCategory): { dot: string; badge: string } {
  return (cat.slug && SLUG_STYLE[cat.slug]) ? SLUG_STYLE[cat.slug] : { dot: "bg-purple-400", badge: "bg-purple-100 text-purple-700" };
}

export const ATTENDANCE_STYLE: Record<AttendanceStatus, { symbol: string; text: string }> = {
  attending: { symbol: "○", text: "text-teal-600" },
  maybe:     { symbol: "△", text: "text-orange-500" },
  absent:    { symbol: "✕", text: "text-red-500" },
  undecided: { symbol: "—", text: "text-gray-400" },
};

// ── 日曜始まり定数 ────────────────────────────────────

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// ── ユーティリティ ────────────────────────────────────

// 日曜始まり: getDay() は 0=日 でそのまま列インデックスと一致するのでオフセット不要
function buildCalendarCells(year: number, month: number) {
  const firstDow    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const total       = Math.ceil((firstDow + daysInMonth) / 7) * 7;
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

export function Calendar({ year, month, today, events, org, onPrevMonth, onNextMonth }: CalendarProps) {
  const cells = buildCalendarCells(year, month);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 月ナビ */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <button onClick={onPrevMonth} aria-label="前の月" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
        <p className="font-semibold text-gray-800">{year}年 {month}月</p>
        <button onClick={onNextMonth} aria-label="次の月" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
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
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-400",
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
            year  === today.getFullYear() &&
            month === today.getMonth() + 1 &&
            day   === today.getDate();
          const dayEvents = day ? eventsOnDay(events, year, month, day) : [];

          return (
            <div
              key={idx}
              className={[
                "min-h-[48px] sm:min-h-[72px] p-1 sm:p-1.5 border-b border-r border-gray-100 last:border-r-0",
                !day      ? "bg-gray-50"      : "bg-white",
                dow === 0 && day ? "bg-red-50/30"  : "",
                dow === 6 && day ? "bg-blue-50/20" : "",
              ].join(" ")}
            >
              {day !== null && (
                <>
                  <div className="flex justify-end mb-1">
                    <span
                      className={[
                        "text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium",
                        isToday   ? "bg-blue-600 text-white"
                          : dow === 0 ? "text-red-500"
                          : dow === 6 ? "text-blue-500"
                          : "text-gray-700",
                      ].join(" ")}
                    >
                      {day}
                    </span>
                  </div>
                  {/* モバイル: ドット（カテゴリ色）＋出欠記号を横並び */}
                  <div className="flex flex-col gap-0.5 mt-0.5 sm:hidden">
                    {dayEvents.map((ev) => {
                      const ss = ATTENDANCE_STYLE[ev.myAttendance];
                      return (
                        <Link
                          key={ev.id}
                          href={ev.concertId ? `/${org}/concerts/${ev.concertId}?tab=attendance` : `/${org}/schedule/${ev.id}`}
                          title={ev.title}
                          className="flex items-center gap-0.5"
                        >
                          <span className={`block w-2 h-2 rounded-full shrink-0 ${getCategoryStyle(ev.category).dot}`} />
                          <span className={`text-[9px] font-bold leading-none ${ss.text}`}>{ss.symbol}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* sm以上: タイトルバッジ */}
                  <div className="hidden sm:block space-y-0.5">
                    {dayEvents.map((ev) => {
                      const ss = ATTENDANCE_STYLE[ev.myAttendance];
                      return (
                        <Link
                          key={ev.id}
                          href={ev.concertId ? `/${org}/concerts/${ev.concertId}?tab=attendance` : `/${org}/schedule/${ev.id}`}
                          className={`flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded ${getCategoryStyle(ev.category).badge} hover:opacity-80 transition-opacity`}
                        >
                          <span className="truncate flex-1">{ev.title}</span>
                          <span className={`shrink-0 font-bold ${ss.text}`}>{ss.symbol}</span>
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
