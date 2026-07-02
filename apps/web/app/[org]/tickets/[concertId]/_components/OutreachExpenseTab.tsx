"use client";

import { useState, useEffect } from "react";
import { Check, Trash2, Loader2, Bus } from "lucide-react";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";

interface OutreachExpenseTabProps {
  orgSlug: string;
  concertId: string;
}

export function OutreachExpenseTab({ orgSlug, concertId }: OutreachExpenseTabProps) {
  const [activities, setActivities] = useState<OutreachActivityRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState<string | null>(null);

  useEffect(() => {
    ticketsApi.listOutreachActivities(orgSlug, concertId)
      .then(setActivities)
      .finally(() => setLoading(false));
  }, [orgSlug, concertId]);

  const handlePay = async (activityId: string) => {
    setPaying(activityId);
    try {
      const updated = await ticketsApi.payOutreachActivity(orgSlug, concertId, activityId);
      setActivities((prev) => prev.map((a) => (a.id === activityId ? updated : a)));
    } finally {
      setPaying(null);
    }
  };

  const handleDelete = async (activityId: string) => {
    if (!confirm("この情宣活動を削除しますか？")) return;
    await ticketsApi.deleteOutreachActivity(orgSlug, concertId, activityId);
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
  };

  const pending      = activities.filter((a) => a.status === "pending");
  const totalExpense = activities.reduce((s, a) => s + a.participants.reduce((ps, p) => ps + (p.expense ?? 0), 0), 0);
  const unpaidExpense = pending.reduce((s, a) => s + a.participants.reduce((ps, p) => ps + (p.expense ?? 0), 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">申請件数</p>
          <p className="text-xl font-bold text-gray-800">{activities.length}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">未払い</p>
          <p className="text-xl font-bold text-red-600">{pending.length}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
        </div>
        {totalExpense > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">未払い交通費</p>
            <p className="text-xl font-bold text-red-600">¥{unpaidExpense.toLocaleString()}</p>
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          <Bus size={24} className="mx-auto mb-2 opacity-30" />
          情宣活動の申請がありません
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const actExpense = a.participants.reduce((s, p) => s + (p.expense ?? 0), 0);
            const actSold    = a.participants.reduce((s, p) => s + p.ticketsSold, 0);
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">{a.destination}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        a.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {a.status === "paid" ? "支払済" : "未払い"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{new Date(a.activityDate).toLocaleDateString("ja-JP")}</span>
                      <span>{a.participants.length}名</span>
                      {actSold > 0 && <span>{actSold}枚販売</span>}
                      {actExpense > 0 && <span>¥{actExpense.toLocaleString()}</span>}
                      <span className="text-gray-300">申請: {a.creatorName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "pending" && (
                      <button
                        onClick={() => handlePay(a.id)}
                        disabled={paying === a.id}
                        className="flex items-center gap-1 text-xs text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-60"
                      >
                        {paying === a.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        支払済みにする
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="px-5 py-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {a.participants.map((p) => (
                      <span key={p.id} className="text-xs text-gray-600">
                        [{p.partName ?? "未"}] {p.memberName}
                        {p.ticketsSold > 0 && <span className="text-gray-400"> {p.ticketsSold}枚</span>}
                        {p.expense != null && <span className="text-brand-500"> ¥{p.expense.toLocaleString()}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
