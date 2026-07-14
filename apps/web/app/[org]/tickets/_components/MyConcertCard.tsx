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
    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
      <span>配布 {totalAllocated}枚</span>
      <span className="text-brand-600 font-medium">販売済み {totalSold}枚</span>
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
      prefetch={false}
      className="hover:border-brand-300 block rounded-xl border border-gray-200 bg-white px-6 py-5 transition-all hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-800">{item.title}</h2>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
            <CalendarDays size={13} />
            {dateStr}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {item.batches.map((b) => (
              <span
                key={b.batchId}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {b.batchName} ¥{b.price.toLocaleString()}
              </span>
            ))}
          </div>
          <MyTotalBadge batches={item.batches} />
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-gray-400" />
      </div>
    </Link>
  );
}
