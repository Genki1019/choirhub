"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Loader2, AlertCircle,
  ChevronRight, Trophy, Plus, Lock, LockOpen, Bus,
} from "lucide-react";
import {
  ticketsApi,
  type TicketDetail, type AllocationRow, type BatchDetail, type UpdateBatchInput,
} from "@/lib/tickets-api";
import { membersApi } from "@/lib/members-api";
import type { MemberProfile } from "@/lib/api-types";
import { ApiClientError } from "@/lib/api-client";
import { CreateBatchModal } from "./_components/CreateBatchModal";
import { EditBatchModal } from "./_components/EditBatchModal";
import { BatchTab } from "./_components/BatchTab";
import { OutreachExpenseTab } from "./_components/OutreachExpenseTab";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function TicketDetailPage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const router = useRouter();

  const [detail,          setDetail]          = useState<TicketDetail | null>(null);
  const [allMembers,      setAllMembers]       = useState<MemberProfile[]>([]);
  const [activeBatchIdx,  setActiveBatchIdx]   = useState<number | "outreach">(0);
  const [loading,         setLoading]          = useState(true);
  const [error,           setError]            = useState<string | null>(null);
  const [showCreateBatch, setShowCreateBatch]  = useState(false);
  const [editingBatch,    setEditingBatch]     = useState<BatchDetail | null>(null);
  const [closingInput,    setClosingInput]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    ticketsApi.get(org, concertId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        if (d.isAdmin) {
          membersApi.list(org).then((m) => { if (!cancelled) setAllMembers(m); }).catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        if (err instanceof ApiClientError && err.status === 403) { setError("チケット担当者または管理者のみアクセスできます"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org, concertId, router]);

  const handleAllocationUpdated = (allocationId: string, data: Partial<AllocationRow>) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        batches: prev.batches.map((batch) => ({
          ...batch,
          allocations: batch.allocations.map((a) =>
            a.id === allocationId ? { ...a, ...data } : a
          ),
        })),
      };
    });
  };

  const handleBatchCreated = (batch: BatchDetail) => {
    setDetail((prev) => prev ? { ...prev, batches: [...prev.batches, batch] } : prev);
    setActiveBatchIdx(detail?.batches.length ?? 0);
    setShowCreateBatch(false);
  };

  const handleBatchUpdated = (batchId: string, data: UpdateBatchInput) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return { ...prev, batches: prev.batches.map((b) => b.id === batchId ? { ...b, ...data } : b) };
    });
    setEditingBatch(null);
  };

  const handleBatchDeleted = (batchId: string) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return { ...prev, batches: prev.batches.filter((b) => b.id !== batchId) };
    });
    setActiveBatchIdx(0);
    setEditingBatch(null);
  };

  const handleMemberAdded = (batchId: string, row: AllocationRow) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        batches: prev.batches.map((b) =>
          b.id === batchId ? { ...b, allocations: [...b.allocations, row] } : b
        ),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error ?? "チケット情報が見つかりません"}</span>
        </div>
      </div>
    );
  }

  const activeBatch = typeof activeBatchIdx === "number" ? detail.batches[activeBatchIdx] : undefined;
  const date    = new Date(detail.concert.heldOn);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        {/* タイトル行 */}
        <PageBleedRow className="flex items-center gap-4 py-3">
          <Link href={`/${org}/tickets`} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-800 truncate">{detail.concert.title}</h1>
            <p className="text-xs text-gray-400">{dateStr}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {detail.isAdmin && (
              detail.concert.ticketInputClosedAt ? (
                <button
                  onClick={async () => {
                    setClosingInput(true);
                    try {
                      await ticketsApi.reopenTicketInput(org, concertId);
                      setDetail((prev) => prev
                        ? { ...prev, concert: { ...prev.concert, ticketInputClosedAt: null } }
                        : prev
                      );
                    } finally { setClosingInput(false); }
                  }}
                  disabled={closingInput}
                  className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-60"
                >
                  {closingInput ? <Loader2 size={13} className="animate-spin" /> : <LockOpen size={13} />}
                  <span className="hidden sm:inline">入力を再開</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setClosingInput(true);
                    try {
                      const result = await ticketsApi.closeTicketInput(org, concertId);
                      setDetail((prev) => prev
                        ? { ...prev, concert: { ...prev.concert, ticketInputClosedAt: result.ticketInputClosedAt } }
                        : prev
                      );
                    } finally { setClosingInput(false); }
                  }}
                  disabled={closingInput}
                  className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-60"
                >
                  {closingInput ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                  <span className="hidden sm:inline">入力を締め切る</span>
                </button>
              )
            )}
            {detail.isAdmin && (
              <button
                onClick={() => setShowCreateBatch(true)}
                className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">席種を追加</span>
              </button>
            )}
            <Link
              href={`/${org}/tickets/${concertId}/race`}
              className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium"
            >
              <Trophy size={14} />
              <span className="hidden sm:inline">チケットレース</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </PageBleedRow>

        {/* 締め切りバナー（タイトル行の外に分離） */}
        {detail.concert.ticketInputClosedAt && (
          <div className="border-t border-red-100 bg-red-50">
            <PageBleedRow className="flex items-center gap-2 text-xs text-red-600 py-2">
              <Lock size={12} className="shrink-0" />
              {new Date(detail.concert.ticketInputClosedAt).toLocaleDateString("ja-JP")} 以降、団員の入力は締め切り済み
            </PageBleedRow>
          </div>
        )}

        {/* 席種タブ */}
        {detail.batches.length > 0 && (
          <div className="border-t border-gray-100">
            <PageBleedRow className="flex pt-1 items-end overflow-x-auto">
              {detail.batches.map((batch, idx) => (
                <div key={batch.id} className="relative group shrink-0">
                  <button
                    onClick={() => setActiveBatchIdx(idx)}
                    className={[
                      "px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                      activeBatchIdx === idx
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700",
                    ].join(" ")}
                  >
                    {batch.name}
                    <span className="ml-1.5 text-gray-400 font-normal">
                      ¥{batch.price.toLocaleString()}
                      {batch.priceStudent != null && ` / 学生¥${batch.priceStudent.toLocaleString()}`}
                    </span>
                  </button>
                  {detail.isAdmin && (
                    <button
                      onClick={() => setEditingBatch(batch)}
                      className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-opacity"
                      title="席種を編集"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setActiveBatchIdx("outreach")}
                className={[
                  "flex items-center gap-1 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ml-2 shrink-0 whitespace-nowrap",
                  activeBatchIdx === "outreach"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                <Bus size={12} />情宣交通費
              </button>
            </PageBleedRow>
          </div>
        )}
      </header>

      <PageMain>
        {detail.batches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 mb-4">席種が登録されていません</p>
            {detail.isAdmin && (
              <button
                onClick={() => setShowCreateBatch(true)}
                className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-medium mx-auto"
              >
                <Plus size={14} />
                最初の席種を追加
              </button>
            )}
          </div>
        ) : activeBatchIdx === "outreach" ? (
          <OutreachExpenseTab orgSlug={org} concertId={concertId} />
        ) : activeBatch ? (
          <BatchTab
            batch={activeBatch}
            detail={detail}
            orgSlug={org}
            concertId={concertId}
            allMembers={allMembers}
            onAllocationUpdated={handleAllocationUpdated}
            onMemberAdded={handleMemberAdded}
          />
        ) : null}
      </PageMain>

      {showCreateBatch && (
        <CreateBatchModal
          orgSlug={org}
          concertId={concertId}
          onCreated={handleBatchCreated}
          onClose={() => setShowCreateBatch(false)}
        />
      )}

      {editingBatch && (
        <EditBatchModal
          orgSlug={org}
          concertId={concertId}
          batch={editingBatch}
          onUpdated={(data) => handleBatchUpdated(editingBatch.id, data)}
          onDeleted={handleBatchDeleted}
          onClose={() => setEditingBatch(null)}
        />
      )}
    </div>
  );
}
