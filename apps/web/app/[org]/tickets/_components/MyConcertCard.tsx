"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { MyAllocationConcert } from "@/lib/tickets-api";

function MyTotalBadge({ batches }: { batches: MyAllocationConcert["batches"] }) {
  const totalSold = batches.reduce((s, b) => s + b.soldAdult + b.soldStudent + b.soldOther, 0);
  const totalAllocated = batches.reduce((s, b) => s + b.allocatedCount, 0);
  const remaining = totalAllocated - totalSold - batches.reduce((s, b) => s + b.returnedCount, 0);

  if (totalAllocated === 0) {
    return <span className="text-xs text-gray-400">配布登録なし</span>;
  }
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
      <span>配布 {totalAllocated}枚</span>
      <span className="text-blue-600 font-medium">販売済み {totalSold}枚</span>
      {remaining > 0 && <span className="text-amber-600">手元残 {remaining}枚</span>}
    </div>
  );
}

export function MyConcertCard({ item, org }: { item: MyAllocationConcert; org: string }) {
  const date = new Date(item.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

  return (
    <Link
      href={`/${org}/tickets/${item.concertId}/my`}
      className="block bg-white rounded-xl border border-gray-200 px-6 py-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800">{item.title}</h2>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-400">
            <CalendarDays size={13} />
            {dateStr}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {item.batches.map((b) => (
              <span key={b.batchId} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {b.batchName} ¥{b.price.toLocaleString()}
              </span>
            ))}
          </div>
          <MyTotalBadge batches={item.batches} />
        </div>
        <ChevronRight size={16} className="text-gray-400 mt-1 shrink-0" />
      </div>
    </Link>
  );
}
