"use client";

import { useState } from "react";
import {
  MapPin,
  Calendar,
  Users,
  Trash2,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import {
  ticketsApi,
  type OutreachActivityRow,
  type OutreachParticipantRow,
} from "@/lib/tickets-api";

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}
function dateLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

interface ActivityCardProps {
  activity: OutreachActivityRow;
  myMemberId: string;
  isAdmin: boolean;
  orgSlug: string;
  concertId: string;
  onDeleted: (id: string) => void;
}

export function ActivityCard({
  activity,
  myMemberId,
  isAdmin,
  orgSlug,
  concertId,
  onDeleted,
}: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = activity.createdById === myMemberId || isAdmin;
  const totalExpense = activity.participants.reduce((s, p) => s + (p.expense ?? 0), 0);
  const totalSold = activity.participants.reduce((s, p) => s + p.ticketsSold, 0);

  const handleDelete = async () => {
    if (!confirm("この情宣活動を削除しますか？")) return;
    setDeleting(true);
    try {
      await ticketsApi.deleteOutreachActivity(orgSlug, concertId, activity.id);
      onDeleted(activity.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <MapPin size={15} className="text-brand-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-800">
              {activity.destination}
            </span>
            {activity.status === "paid" && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
                <BadgeCheck size={10} /> 支払済
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {dateLabel(activity.activityDate)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={10} />
              {activity.participants.length}名
            </span>
            {totalSold > 0 && <span>{totalSold}枚</span>}
            {totalExpense > 0 && <span>{yen(totalExpense)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={deleting}
              aria-label={`${activity.destination}を削除`}
              className="p-1 text-gray-300 transition-colors hover:text-red-400"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
          {expanded ? (
            <ChevronUp size={14} className="text-gray-400" />
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-4">
          {activity.note && (
            <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {activity.note}
            </p>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="pb-1.5 font-medium">名前</th>
                <th className="pb-1.5 text-right font-medium">販売</th>
                <th className="pb-1.5 text-right font-medium">交通費</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activity.participants.map((p: OutreachParticipantRow) => (
                <tr key={p.id}>
                  <td className="py-1.5 text-gray-700">
                    <span className="mr-1 text-gray-400">[{p.partName ?? "未"}]</span>
                    {p.memberName}
                  </td>
                  <td className="py-1.5 text-right text-gray-700">{p.ticketsSold}枚</td>
                  <td className="py-1.5 text-right text-gray-700">
                    {p.expense != null ? yen(p.expense) : "―"}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalExpense > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="pt-2 text-gray-500">合計</td>
                  <td className="pt-2 text-right font-medium text-gray-700">{totalSold}枚</td>
                  <td className="pt-2 text-right font-medium text-gray-700">{yen(totalExpense)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <p className="mt-2 text-[10px] text-gray-400">申請者: {activity.creatorName}</p>
        </div>
      )}
    </div>
  );
}
