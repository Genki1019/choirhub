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
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Clock size={15} />
          出欠締切
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={[
            "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
            hasDeadline ? "bg-blue-600" : "bg-gray-200",
          ].join(" ")}
        >
          <span className={[
            "inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5",
            hasDeadline ? "translate-x-4 ml-0.5" : "translate-x-0.5",
          ].join(" ")} />
        </button>
      </div>
      {hasDeadline ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={deadlineDate}
            max={startDate}
            onChange={e => onDateChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <input
            type="time"
            value={deadlineTime}
            onChange={e => onTimeChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400">締切を設定しない場合、出欠はイベント開始まで変更可能です。</p>
      )}
    </div>
  );
}
