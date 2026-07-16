"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare, Loader2 } from "lucide-react";
import type { MemberProfile, PartSummary } from "@/lib/members-api";
import type { AttendanceStatus } from "@/lib/events-api";

export interface LocalAttendance {
  status: AttendanceStatus;
  arriveTime: string | null;
  leaveTime: string | null;
  dayMemo: string | null;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    symbol: string;
    label: string;
    cell: string;
    text: string;
  }
> = {
  attending: {
    symbol: "○",
    label: "参加",
    cell: "bg-teal-50  hover:bg-teal-100",
    text: "text-teal-600",
  },
  maybe: {
    symbol: "△",
    label: "未定",
    cell: "bg-orange-50 hover:bg-orange-100",
    text: "text-orange-500",
  },
  absent: {
    symbol: "✕",
    label: "欠席",
    cell: "bg-red-50   hover:bg-red-100",
    text: "text-red-500",
  },
  undecided: {
    symbol: "—",
    label: "未回答",
    cell: "bg-gray-50  hover:bg-gray-100",
    text: "text-gray-400",
  },
};

interface MemoRowProps {
  memberId: string;
  attendance: LocalAttendance;
  saving: boolean;
  onSave: (data: Partial<LocalAttendance>) => void;
}

function MemoRow({ memberId, attendance, saving, onSave }: MemoRowProps) {
  const [arrive, setArrive] = useState(attendance.arriveTime ?? "");
  const [leave, setLeave] = useState(attendance.leaveTime ?? "");
  const [memo, setMemo] = useState(attendance.dayMemo ?? "");

  return (
    <div className="space-y-2 border-t border-orange-100 bg-orange-50 px-4 py-3">
      <p className="text-xs font-medium text-orange-700">△ 詳細を入力してください</p>
      <div className="flex gap-3">
        <div>
          <label
            htmlFor={`memo-arrive-${memberId}`}
            className="mb-1 block text-[10px] text-gray-500"
          >
            遅刻: 到着予定
          </label>
          <input
            id={`memo-arrive-${memberId}`}
            type="time"
            value={arrive}
            onChange={(e) => setArrive(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-orange-300 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor={`memo-leave-${memberId}`}
            className="mb-1 block text-[10px] text-gray-500"
          >
            早退: 退席予定
          </label>
          <input
            id={`memo-leave-${memberId}`}
            type="time"
            value={leave}
            onChange={(e) => setLeave(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-orange-300 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`memo-text-${memberId}`} className="mb-1 block text-[10px] text-gray-500">
          メモ
        </label>
        <input
          id={`memo-text-${memberId}`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="連絡事項など"
          maxLength={100}
          className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-orange-300 focus:outline-none"
        />
      </div>
      <button
        onClick={() =>
          onSave({ arriveTime: arrive || null, leaveTime: leave || null, dayMemo: memo || null })
        }
        disabled={saving}
        className="flex items-center gap-1.5 rounded bg-orange-500 px-3 py-1 text-xs text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
      >
        {saving && <Loader2 size={10} className="animate-spin" />}
        保存
      </button>
    </div>
  );
}

interface AttendanceTableProps {
  partGroups: Array<{ part: PartSummary; members: MemberProfile[] }>;
  unassigned: MemberProfile[];
  attendances: Record<string, LocalAttendance>;
  selfId: string | null;
  isLocked: boolean;
  expandedId: string | null;
  saving: boolean;
  onCycleStatus: (memberId: string) => void;
  onSaveMemo: (memberId: string, data: Partial<LocalAttendance>) => void;
  onSetExpandedId: (id: string | null) => void;
}

export function AttendanceTable({
  partGroups,
  unassigned,
  attendances,
  selfId,
  isLocked,
  expandedId,
  saving,
  onCycleStatus,
  onSaveMemo,
  onSetExpandedId,
}: AttendanceTableProps) {
  const counts = Object.values(attendances).reduce(
    (acc, a) => {
      acc[a.status]++;
      return acc;
    },
    { attending: 0, absent: 0, maybe: 0, undecided: 0 } as Record<AttendanceStatus, number>,
  );

  const allGroups = [
    ...partGroups,
    ...(unassigned.length > 0
      ? [
          {
            part: { id: "__none__", name: "パート未設定", sortOrder: 99, voiceType: "other" },
            members: unassigned,
          },
        ]
      : []),
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[1fr_80px] border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 sm:grid-cols-[1fr_80px_1fr]">
        <span>名前</span>
        <span className="text-center">出欠</span>
        <span className="hidden pl-3 sm:block">メモ</span>
      </div>

      {allGroups.map(({ part, members: partMembers }) => {
        const pc = partMembers.reduce(
          (acc, m) => {
            acc[attendances[m.id]?.status ?? "undecided"]++;
            return acc;
          },
          { attending: 0, absent: 0, maybe: 0, undecided: 0 } as Record<AttendanceStatus, number>,
        );

        return (
          <div key={part.id}>
            <div className="grid grid-cols-[1fr_80px] border-y border-gray-200 bg-gray-100 px-4 py-1.5 sm:grid-cols-[1fr_80px_1fr]">
              <span className="text-xs font-bold text-gray-500">{part.name}</span>
              <span className="text-center text-[10px] text-gray-400">
                ○{pc.attending} △{pc.maybe} ✕{pc.absent}
              </span>
              <span className="hidden sm:block" />
            </div>

            {partMembers.map((member) => {
              const att = attendances[member.id] ?? {
                status: "undecided" as AttendanceStatus,
                arriveTime: null,
                leaveTime: null,
                dayMemo: null,
              };
              const sc = STATUS_CONFIG[att.status];
              const isSelf = member.id === selfId;
              const isExpanded = expandedId === member.id;
              const hasMemo = att.dayMemo || att.arriveTime || att.leaveTime;

              return (
                <div key={member.id} className="border-b border-gray-100 last:border-0">
                  <div className="grid grid-cols-[1fr_80px] items-center px-4 py-2.5 sm:grid-cols-[1fr_80px_1fr]">
                    <div className="flex min-w-0 flex-col">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`truncate text-sm font-medium ${isSelf ? "text-brand-600" : "text-gray-800"}`}
                        >
                          {member.nameJa}
                        </span>
                        {isSelf && (
                          <span className="text-brand-400 shrink-0 text-[10px]">（自分）</span>
                        )}
                      </div>
                      <div className="mt-0.5 sm:hidden">
                        {att.status === "maybe" && isSelf && !isLocked ? (
                          <button
                            onClick={() => onSetExpandedId(isExpanded ? null : member.id)}
                            className="flex items-center gap-1 text-xs text-orange-500 transition-colors hover:text-orange-700"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {hasMemo ? "詳細を編集" : "詳細を入力"}
                          </button>
                        ) : hasMemo ? (
                          <span className="flex items-center gap-1 truncate text-xs text-gray-400">
                            <MessageSquare size={10} className="shrink-0" />
                            <span className="truncate">
                              {[
                                att.arriveTime && `${att.arriveTime}着`,
                                att.leaveTime && `${att.leaveTime}退`,
                                att.dayMemo,
                              ]
                                .filter(Boolean)
                                .join(" / ")}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={() => onCycleStatus(member.id)}
                        disabled={isLocked || !isSelf}
                        className={[
                          "h-8 w-10 rounded-lg text-sm font-bold transition-all",
                          sc.cell,
                          sc.text,
                          isSelf && !isLocked ? "cursor-pointer active:scale-95" : "cursor-default",
                        ].join(" ")}
                        title={isSelf && !isLocked ? "クリックで変更" : sc.label}
                      >
                        {sc.symbol}
                      </button>
                    </div>

                    <div className="hidden min-w-0 items-center gap-1 pl-3 sm:flex">
                      {att.status === "maybe" && isSelf && !isLocked ? (
                        <button
                          onClick={() => onSetExpandedId(isExpanded ? null : member.id)}
                          className="flex items-center gap-1 text-xs text-orange-500 transition-colors hover:text-orange-700"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {hasMemo ? "詳細を編集" : "詳細を入力"}
                        </button>
                      ) : hasMemo ? (
                        <span className="flex items-center gap-1 truncate text-xs text-gray-400">
                          <MessageSquare size={10} className="shrink-0" />
                          <span className="truncate">
                            {[
                              att.arriveTime && `${att.arriveTime}着`,
                              att.leaveTime && `${att.leaveTime}退`,
                              att.dayMemo,
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {isExpanded && att.status === "maybe" && (
                    <MemoRow
                      memberId={member.id}
                      attendance={att}
                      saving={saving}
                      onSave={(data) => onSaveMemo(member.id, data)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="grid grid-cols-[1fr_80px] border-t-2 border-gray-200 bg-gray-50 px-4 py-3 sm:grid-cols-[1fr_80px_1fr]">
        <span className="text-xs font-bold text-gray-600">集計</span>
        <div className="flex items-center justify-center gap-2 text-xs font-semibold">
          <span className="text-teal-600">○{counts.attending}</span>
          <span className="text-orange-500">△{counts.maybe}</span>
          <span className="text-red-500">✕{counts.absent}</span>
          <span className="text-gray-400">—{counts.undecided}</span>
        </div>
        <span className="hidden sm:block" />
      </div>
    </div>
  );
}
