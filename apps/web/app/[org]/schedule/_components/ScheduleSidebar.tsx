import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { type EventSummary, type AttendanceStatus } from "@/lib/events-api";
import { getCategoryColor, ATTENDANCE_STYLE } from "./Calendar";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateFull(iso: string) {
  const d = new Date(iso);
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）`;
}

interface ScheduleSidebarProps {
  events: EventSummary[];
  upcomingEvents: EventSummary[];
  org: string;
}

export function ScheduleSidebar({ events, upcomingEvents, org }: ScheduleSidebarProps) {
  const categories = Array.from(new Map(events.map((e) => [e.category.id, e.category])).values());

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">種別</p>
          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(cat) }} />
                <span className="text-xs text-gray-600">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">自分の出欠</p>
          <div className="space-y-1.5">
            {(Object.entries(ATTENDANCE_STYLE) as [AttendanceStatus, typeof ATTENDANCE_STYLE[AttendanceStatus]][]).map(([status, s]) => (
              <div key={status} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-4 text-center ${s.text}`}>{s.symbol}</span>
                <span className="text-xs text-gray-600">
                  {{ attending: "参加", maybe: "未定", absent: "欠席", undecided: "未回答" }[status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500">直近の予定</p>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">予定はありません</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {upcomingEvents.map((ev) => {
              const ss = ATTENDANCE_STYLE[ev.myAttendance];
              return (
                <Link
                  key={ev.id}
                  href={ev.concertId ? `/${org}/concerts/${ev.concertId}?tab=attendance` : `/${org}/schedule/${ev.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(ev.category) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{ev.title}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                      <Clock size={9} />
                      {formatDateFull(ev.startsAt)} {formatTime(ev.startsAt)}〜
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                        <MapPin size={9} />
                        {ev.location}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 text-sm font-bold mt-0.5 ${ss.text}`}>{ss.symbol}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
