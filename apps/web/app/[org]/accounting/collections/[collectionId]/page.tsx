"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, AlertCircle, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingApi } from "@/lib/accounting-api";
import type {
  CollectionDetail, CollectionPaymentItem, CollectionPaymentStatus, PaymentMethod,
} from "@/lib/accounting-api";
import { ApiClientError } from "@/lib/api-client";
import { accountingKeys } from "@/lib/query-keys";
import { RecordModal } from "./_components/RecordModal";
import { PaymentsList } from "./_components/PaymentsList";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function CollectionDetailPage() {
  const { org, collectionId } = useParams<{ org: string; collectionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selected,   setSelected]   = useState<CollectionPaymentItem | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulking,    setBulking]    = useState(false);
  const [toast,      setToast]      = useState<string | null>(null);

  const { data: col, isLoading: loading, error } = useQuery({
    queryKey: accountingKeys.collection(org, collectionId),
    queryFn:  () => accountingApi.getCollection(org, collectionId),
  });

  useEffect(() => {
    if (error instanceof ApiClientError && error.status === 403) {
      router.replace(`/${org}`);
    }
  }, [error, org, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleQuickPaid = async (payment: CollectionPaymentItem) => {
    if (!col) return;
    try {
      const updated = await accountingApi.recordPayment(org, collectionId, payment.member.id, {
        status: "paid",
        amount: payment.amount ?? col.amount,
        paidAt: new Date().toISOString(),
        method: "cash",
      });
      queryClient.setQueryData<CollectionDetail>(accountingKeys.collection(org, collectionId), (prev) =>
        prev ? {
          ...prev,
          payments: prev.payments.map((p) => p.id === payment.id ? { ...p, ...updated } : p),
        } : prev
      );
      showToast(`${payment.member.nameJa} の支払いを記録しました`);
    } catch {
      showToast("記録に失敗しました");
    }
  };

  const handleModalSaved = (updated: CollectionPaymentItem) => {
    queryClient.setQueryData<CollectionDetail>(accountingKeys.collection(org, collectionId), (prev) =>
      prev ? {
        ...prev,
        payments: prev.payments.map((p) => p.id === selected?.id ? { ...p, ...updated } : p),
      } : prev
    );
    setSelected(null);
    showToast("更新しました");
  };

  const toggleCheck = (memberId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectAllPending = () => {
    if (!col) return;
    setCheckedIds(new Set(col.payments.filter((p) => p.status === "pending").map((p) => p.member.id)));
  };

  const clearChecked = () => setCheckedIds(new Set());

  const handleBulkPaid = async () => {
    if (!col || checkedIds.size === 0) return;
    setBulking(true);
    const memberIds = Array.from(checkedIds);
    try {
      await accountingApi.bulkRecordPayment(org, collectionId, {
        memberIds,
        status: "paid",
        paidAt: new Date().toISOString(),
        method: "cash",
      });
      const paidAt = new Date().toISOString();
      queryClient.setQueryData<CollectionDetail>(accountingKeys.collection(org, collectionId), (prev) => {
        if (!prev) return prev;
        const ids = new Set(memberIds);
        return {
          ...prev,
          payments: prev.payments.map((p) =>
            ids.has(p.member.id)
              ? { ...p, status: "paid" as CollectionPaymentStatus, paidAt, method: "cash" as PaymentMethod, amount: p.amount ?? prev.amount }
              : p
          ),
        };
      });
      clearChecked();
      queryClient.invalidateQueries({ queryKey: accountingKeys.all(org) });
      showToast(`${memberIds.length}名を現金支払済みにしました`);
    } catch {
      showToast("一括処理に失敗しました");
    } finally {
      setBulking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !col) {
    return (
      <div className="flex items-center gap-2 m-8 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
        <AlertCircle size={16} />
        <span className="text-sm">{error?.message ?? "徴収が見つかりません"}</span>
      </div>
    );
  }

  const paid      = col.payments.filter((p) => p.status === "paid").length;
  const pending   = col.payments.filter((p) => p.status === "pending").length;
  const paidAmount = col.payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount ?? col.amount), 0);

  return (
    <div className="flex flex-col">
      <header className="shrink-0 bg-white border-b border-gray-200">
        <PageBleedRow className="flex items-center gap-4 py-4">
          <Link href={`/${org}/accounting`} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-gray-800">{col.title}</h1>
            <p className="text-xs text-gray-400">¥{col.amount.toLocaleString()}/人</p>
          </div>
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {([
            { label: "対象人数", value: col.payments.length,              color: "text-gray-800" },
            { label: "支払済",   value: paid,                            color: "text-teal-600" },
            { label: "未払い",   value: pending,                         color: "text-amber-600" },
            { label: "徴収済額", value: `¥${paidAmount.toLocaleString()}`, color: "text-teal-700" },
          ] as { label: string; value: number | string; color: string }[]).map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <PaymentsList
          payments={col.payments}
          amount={col.amount}
          checkedIds={checkedIds}
          onToggleCheck={toggleCheck}
          onSelectAllPending={selectAllPending}
          onQuickPaid={handleQuickPaid}
          onEdit={setSelected}
        />
      </PageMain>

      {checkedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl z-40">
          <span className="text-sm font-medium">{checkedIds.size}名選択中</span>
          <button
            onClick={handleBulkPaid}
            disabled={bulking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:opacity-60 rounded-lg transition-colors"
          >
            {bulking ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            一括現金支払済み
          </button>
          <button
            onClick={clearChecked}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="選択解除"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {selected && col && (
        <RecordModal
          payment={selected}
          defaultAmount={col.amount}
          org={org}
          collectionId={collectionId}
          onClose={() => setSelected(null)}
          onSaved={handleModalSaved}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <Check size={13} className="text-teal-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
