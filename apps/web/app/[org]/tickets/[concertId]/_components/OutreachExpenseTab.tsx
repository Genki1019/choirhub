"use client";

import { useState } from "react";
import { Check, Undo2, Trash2, Loader2, Bus } from "lucide-react";
import { ticketsApi } from "@/lib/tickets-api";
import { useOutreachActivities } from "@/hooks/useOutreachActivities";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

interface OutreachExpenseTabProps {
  orgSlug: string;
  concertId: string;
}

export function OutreachExpenseTab({ orgSlug, concertId }: OutreachExpenseTabProps) {
  const { data, isLoading, error, updateActivity, removeActivity } = useOutreachActivities(
    orgSlug,
    concertId,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const handlePay = async (activityId: string) => {
    setUpdatingId(activityId);
    setActivitiesError(null);
    try {
      updateActivity(await ticketsApi.payOutreachActivity(orgSlug, concertId, activityId));
    } catch (err: unknown) {
      setActivitiesError(
        userErrorMessage(err, "支払いの記録に失敗しました。もう一度お試しください。"),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnpay = async (activityId: string) => {
    setUpdatingId(activityId);
    setActivitiesError(null);
    try {
      updateActivity(await ticketsApi.unpayOutreachActivity(orgSlug, concertId, activityId));
    } catch (err: unknown) {
      setActivitiesError(
        userErrorMessage(err, "支払いの取り消しに失敗しました。もう一度お試しください。"),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (activityId: string) => {
    if (!confirm("この情宣活動を削除しますか？")) return;
    setUpdatingId(activityId);
    setActivitiesError(null);
    try {
      await ticketsApi.deleteOutreachActivity(orgSlug, concertId, activityId);
      removeActivity(activityId);
    } catch (err: unknown) {
      setActivitiesError(
        userErrorMessage(err, "情宣活動の削除に失敗しました。もう一度お試しください。"),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <ErrorMessage variant="section">
        {userErrorMessage(
          error,
          "情宣活動の読み込みに失敗しました。ページを再読み込みしてください。",
        )}
      </ErrorMessage>
    );
  }

  const { activities } = data;
  const pending = activities.filter((a) => a.status === "pending");
  const totalExpense = activities.reduce(
    (s, a) => s + a.participants.reduce((ps, p) => ps + (p.expense ?? 0), 0),
    0,
  );
  const unpaidExpense = pending.reduce(
    (s, a) => s + a.participants.reduce((ps, p) => ps + (p.expense ?? 0), 0),
    0,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ErrorMessage autoScroll={false}>
        {error &&
          userErrorMessage(
            error,
            "最新の情宣活動の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
      </ErrorMessage>
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center">
          <p className="mb-0.5 text-xs text-gray-400">申請件数</p>
          <p className="text-xl font-bold text-gray-800">
            {activities.length}
            <span className="ml-1 text-sm font-normal text-gray-400">件</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center">
          <p className="mb-0.5 text-xs text-gray-400">未払い</p>
          <p className="text-xl font-bold text-red-600">
            {pending.length}
            <span className="ml-1 text-sm font-normal text-gray-400">件</span>
          </p>
        </div>
        {totalExpense > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center">
            <p className="mb-0.5 text-xs text-gray-400">未払い交通費</p>
            <p className="text-xl font-bold text-red-600">¥{unpaidExpense.toLocaleString()}</p>
          </div>
        )}
      </div>

      <ErrorMessage>{activitiesError}</ErrorMessage>

      {activities.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          <Bus size={24} className="mx-auto mb-2 opacity-30" />
          情宣活動の申請がありません
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const actExpense = a.participants.reduce((s, p) => s + (p.expense ?? 0), 0);
            const actSold = a.participants.reduce((s, p) => s + p.ticketsSold, 0);
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{a.destination}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          a.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {a.status === "paid" ? "支払済" : "未払い"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(a.activityDate).toLocaleDateString("ja-JP")}</span>
                      <span>{a.participants.length}名</span>
                      {actSold > 0 && <span>{actSold}枚販売</span>}
                      {actExpense > 0 && <span>¥{actExpense.toLocaleString()}</span>}
                      <span className="text-gray-300">申請: {a.creatorName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handlePay(a.id)}
                        disabled={updatingId === a.id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {updatingId === a.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Check size={11} />
                        )}
                        支払済みにする
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUnpay(a.id)}
                        disabled={updatingId === a.id}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                      >
                        {updatingId === a.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Undo2 size={11} />
                        )}
                        未払いに戻す
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      disabled={updatingId === a.id}
                      aria-label={`${a.destination}を削除`}
                      className="p-1 text-gray-300 transition-colors hover:text-red-400 disabled:opacity-40"
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
                        {p.ticketsSold > 0 && (
                          <span className="text-gray-400"> {p.ticketsSold}枚</span>
                        )}
                        {p.expense != null && (
                          <span className="text-brand-500"> ¥{p.expense.toLocaleString()}</span>
                        )}
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
