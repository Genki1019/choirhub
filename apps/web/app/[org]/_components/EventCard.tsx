import Link from "next/link";
import { MapPin, Circle } from "lucide-react";
import type { AttendanceStatus, EventCardItem } from "@/lib/events-api";
import { getConcertHref, type ConcertLinkSource } from "@/lib/routes";

const ATTENDANCE_LABEL: Record<AttendanceStatus, { label: string; className: string }> = {
  attending: { label: "参加",   className: "text-teal-600" },
  absent:    { label: "欠席",   className: "text-red-500" },
  maybe:     { label: "未定",   className: "text-yellow-600" },
  undecided: { label: "未回答", className: "text-gray-400" },
};

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}〜`;
}

export function EventCard({ event, org, from = "home" }: { event: EventCardItem; org: string; from?: ConcertLinkSource }) {
  const status = ATTENDANCE_LABEL[event.myAttendance];
  const href = event.concertId ? getConcertHref(org, event.concertId, from) : `/${org}/schedule/${event.id}`;

  return (
    <Link
      href={href}
      prefetch={false}
      className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
    >
      <div className="w-1 shrink-0" style={{ backgroundColor: event.category.color }} />
      <div className="flex-1 px-5 py-4">
        <p className="text-xs text-gray-400 mb-1">{formatEventDate(event.startsAt)}</p>
        <p className="font-semibold text-gray-800">{event.title}</p>
        {event.location && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
            <MapPin size={12} className="text-gray-400 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${status.className}`}>
          <Circle size={10} className="fill-current" />
          {status.label}
        </div>
      </div>
    </Link>
  );
}
