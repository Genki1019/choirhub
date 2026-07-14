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
  orgSlug,
  allocationId,
  initialCount,
  isClosed,
}: OutreachCountCardProps) {
  const [count, setCount] = useState(initialCount);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <span className="text-sm font-semibold text-gray-800">情宣回数</span>
        <span className="ml-2 text-xs text-gray-400">この演奏会全体で情宣に行った回数</span>
      </div>
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">情宣に行った回数</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCount(Math.max(0, count - 1))}
              disabled={isClosed}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-xl leading-none text-gray-500 transition-colors select-none hover:bg-gray-100 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(Math.max(0, Number(e.target.value)))}
              disabled={isClosed}
              className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-medium focus:ring-2 focus:ring-purple-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => setCount(count + 1)}
              disabled={isClosed}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-xl leading-none text-gray-500 transition-colors select-none hover:bg-gray-100 disabled:opacity-40"
            >
              ＋
            </button>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isClosed || saving || count === initialCount}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : saved ? (
            <Check size={13} />
          ) : null}
          {saved ? "保存しました" : "情宣回数を保存"}
        </button>
      </div>
    </div>
  );
}
