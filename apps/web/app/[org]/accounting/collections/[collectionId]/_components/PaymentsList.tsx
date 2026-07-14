import { Check, CheckSquare } from "lucide-react";
import { PAYMENT_METHOD_LABEL } from "@/lib/accounting-api";
import type { CollectionPaymentItem } from "@/lib/accounting-api";
import { comparePartOrder } from "@/lib/voice-order";
import { StatusBadge } from "./RecordModal";

interface PaymentsListProps {
  payments: CollectionPaymentItem[];
  amount: number;
  checkedIds: Set<string>;
  onToggleCheck: (memberId: string) => void;
  onSelectAllPending: () => void;
  onQuickPaid: (payment: CollectionPaymentItem) => void;
  onEdit: (payment: CollectionPaymentItem) => void;
}

export function PaymentsList({
  payments,
  amount,
  checkedIds,
  onToggleCheck,
  onSelectAllPending,
  onQuickPaid,
  onEdit,
}: PaymentsListProps) {
  const paid = payments.filter((p) => p.status === "paid").length;
  const pending = payments.filter((p) => p.status === "pending").length;
  const waived = payments.filter((p) => p.status === "waived").length;

  const partGroups = (() => {
    const map = new Map<
      string,
      {
        partId: string;
        partName: string;
        voiceType: string;
        sortOrder: number;
        payments: CollectionPaymentItem[];
      }
    >();
    for (const p of payments) {
      const key = p.member.part?.id ?? "__none__";
      if (!map.has(key)) {
        map.set(key, {
          partId: p.member.part?.id ?? "__none__",
          partName: p.member.part?.name ?? "パートなし",
          voiceType: p.member.part?.voiceType ?? "zzz",
          sortOrder: p.member.part?.sortOrder ?? 999,
          payments: [],
        });
      }
      map.get(key)!.payments.push(p);
    }
    return Array.from(map.values()).sort((a, b) =>
      comparePartOrder(
        { voiceType: a.voiceType, sortOrder: a.sortOrder },
        { voiceType: b.voiceType, sortOrder: b.sortOrder },
      ),
    );
  })();

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold text-gray-700">支払い状況</p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">
            {paid}名支払済 / {pending}名未払い
            {waived > 0 && ` / ${waived}名免除`}
          </p>
          {pending > 0 && (
            <button
              onClick={onSelectAllPending}
              className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-xs transition-colors"
            >
              <CheckSquare size={13} />
              未払いを全選択
            </button>
          )}
        </div>
      </div>

      {partGroups.map((group, gi) => {
        const groupPaid = group.payments.filter((p) => p.status === "paid").length;
        const groupPending = group.payments.filter((p) => p.status === "pending").length;
        return (
          <div key={group.partId}>
            <div
              className={`flex items-center justify-between bg-gray-50 px-5 py-2 ${gi > 0 ? "border-t border-gray-200" : ""}`}
            >
              <span className="text-xs font-semibold text-gray-600">{group.partName}</span>
              <span className="text-xs text-gray-400">
                {groupPaid}/{group.payments.length}名支払済
                {groupPending > 0 && (
                  <span className="ml-1 text-amber-600">（{groupPending}名未払い）</span>
                )}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {group.payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-3 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(payment.member.id)}
                    onChange={() => onToggleCheck(payment.member.id)}
                    className="text-brand-600 focus:ring-brand-400 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{payment.member.nameJa}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      {payment.status === "paid" && payment.paidAt && (
                        <span>{new Date(payment.paidAt).toLocaleDateString("ja-JP")}</span>
                      )}
                      {payment.status === "paid" && payment.method && (
                        <span>{PAYMENT_METHOD_LABEL[payment.method]}</span>
                      )}
                      <span
                        className={
                          payment.amount != null && payment.amount !== amount
                            ? payment.status === "pending"
                              ? "font-medium text-amber-500"
                              : "text-teal-600"
                            : "text-gray-400"
                        }
                      >
                        ¥{(payment.amount ?? amount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <StatusBadge status={payment.status} />

                  <div className="flex shrink-0 items-center gap-1">
                    {payment.status === "pending" && (
                      <button
                        onClick={() => onQuickPaid(payment)}
                        title="現金 支払済みにする"
                        className="flex items-center gap-1 rounded-lg border border-teal-200 px-2 py-1 text-xs text-teal-600 transition-colors hover:bg-teal-50"
                      >
                        <Check size={11} />
                        支払済
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(payment)}
                      className="hover:text-brand-500 p-1.5 text-gray-300 transition-colors"
                      title="詳細編集"
                    >
                      <span className="text-xs">編集</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
