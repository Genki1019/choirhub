"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { TicketConcertSummary } from "@/lib/tickets-api";

function SoldBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.round(rate * 100));
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-brand-500" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium ${pct >= 80 ? "text-green-600" : pct >= 50 ? "text-brand-600" : "text-gray-400"}`}
      >
        {pct}%
      </span>
    </div>
  );
}

export function ManagerConcertCard({ item, org }: { item: TicketConcertSummary; org: string }) {
  const date = new Date(item.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const unreported = item.memberCount - item.collectedCount;

  return (
    <Link
      href={`/${org}/tickets/${item.concertId}`}
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
          {item.batchCount === 0 ? (
            <p className="mt-3 text-xs text-gray-400">席種未登録</p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-4">
                <SoldBar rate={item.soldRate} />
                <span className="text-xs text-gray-500">
                  {item.totalSold} / {item.totalAllocated}枚 販売済み
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{item.memberCount}名配布</span>
                {unreported > 0 && (
                  <span className="font-medium text-amber-600">未集金 {unreported}名</span>
                )}
              </div>
            </div>
          )}
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-gray-400" />
      </div>
    </Link>
  );
}
