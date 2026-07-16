"use client";

import { Clock } from "lucide-react";

interface DeadlineSectionProps {
  hasDeadline: boolean;
  deadlineDate: string;
  deadlineTime: string;
  startDate: string;
  onToggle: () => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export function DeadlineSection({
  hasDeadline,
  deadlineDate,
  deadlineTime,
  startDate,
  onToggle,
  onDateChange,
  onTimeChange,
}: DeadlineSectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Clock size={15} />
          出欠締切
        </div>
        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={hasDeadline}
          aria-label="出欠締切を設定する"
          className={[
            "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
            hasDeadline ? "bg-brand-600" : "bg-gray-200",
          ].join(" ")}
        >
          <span
            className={[
              "mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
              hasDeadline ? "ml-0.5 translate-x-4" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>
      {hasDeadline ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={deadlineDate}
            max={startDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="focus:ring-brand-400 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
          <input
            type="time"
            value={deadlineTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className="focus:ring-brand-400 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          締切を設定しない場合、出欠はイベント開始まで変更可能です。
        </p>
      )}
    </div>
  );
}
