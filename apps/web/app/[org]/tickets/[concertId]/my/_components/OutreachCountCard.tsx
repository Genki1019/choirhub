"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { ticketsApi } from "@/lib/tickets-api";

interface OutreachCountCardProps {
  orgSlug: string;
  allocationId: string;
  initialCount: number;
  isClosed: boolean;
}

export function OutreachCountCard({
  orgSlug, allocationId, initialCount, isClosed,
}: OutreachCountCardProps) {
  const [count,   setCount]   = useState(initialCount);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ticketsApi.updateAllocation(orgSlug, allocationId, { outreachCount: count });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <span className="font-semibold text-gray-800 text-sm">情宣回数</span>
        <span className="ml-2 text-xs text-gray-400">この演奏会全体で情宣に行った回数</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600">情宣に行った回数</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCount(Math.max(0, count - 1))}
              disabled={isClosed}
              className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 text-xl leading-none flex items-center justify-center transition-colors select-none disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(Math.max(0, Number(e.target.value)))}
              disabled={isClosed}
              className="w-14 text-center text-sm font-medium border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setCount(count + 1)}
              disabled={isClosed}
              className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 text-xl leading-none flex items-center justify-center transition-colors select-none disabled:opacity-40"
            >
              ＋
            </button>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isClosed || saving || count === initialCount}
          className="w-full py-2 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
          {saved ? "保存しました" : "情宣回数を保存"}
        </button>
      </div>
    </div>
  );
}
