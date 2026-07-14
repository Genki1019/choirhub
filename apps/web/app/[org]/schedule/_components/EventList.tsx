import { CalendarDays } from "lucide-react";
import type { EventSummary } from "@/lib/events-api";
import { EventCard } from "../../_components/EventCard";

interface EventListProps {
  events: EventSummary[];
  year: number;
  month: number;
  org: string;
}

function emptyMessage(year: number, month: number, today: Date): string {
  const isFuture =
    year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);

  return isFuture ? "予定はありません" : "予定はすべて終了しました";
}

export function EventList({ events, year, month, org }: EventListProps) {
  const today = new Date();

  const monthEvents = events
    .filter((e) => {
      const d = new Date(e.startsAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month && d >= today;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
        <CalendarDays size={14} className="text-gray-400" />
        {month}月の予定
      </h2>
      {monthEvents.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">{emptyMessage(year, month, today)}</p>
      ) : (
        <div className="space-y-3">
          {monthEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} org={org} from="schedule" />
          ))}
        </div>
      )}
    </div>
  );
}
