"use client";

import { useState } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { ticketsApi, type BatchDetail, type AllocationRow } from "@/lib/tickets-api";
import type { MemberProfile } from "@/lib/api-types";

interface AddMemberPanelProps {
  batch: BatchDetail;
  orgSlug: string;
  concertId: string;
  allMembers: MemberProfile[];
  onAdded: (row: AllocationRow) => void;
}

export function AddMemberPanel({
  batch, orgSlug, concertId, allMembers, onAdded,
}: AddMemberPanelProps) {
  const [open,       setOpen]       = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [count,      setCount]      = useState("0");
  const [saving,     setSaving]     = useState(false);

  const allocatedIds = new Set(batch.allocations.map((a) => a.memberId));
  const unallocated  = allMembers.filter((m) => !allocatedIds.has(m.id) && m.status === "active");

  if (unallocated.length === 0) return null;

  const handleAdd = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await ticketsApi.allocate(orgSlug, concertId, {
        batchId:        batch.id,
        memberId:       selectedId,
        allocatedCount: Number(count),
      });
      const member = allMembers.find((m) => m.id === selectedId)!;
      onAdded({
        id:                    "",
        batchId:               batch.id,
        memberId:              selectedId,
        nameJa:                member.nameJa,
        partId:                member.part?.id ?? null,
        partName:              member.part?.name ?? null,
        partSortOrder:         99,
        partVoiceType:         "other",
        allocatedCount:        Number(count),
        requestedCount:        null,
        soldAdult:             0,
        soldStudent:           0,
        soldOther:             0,
        returnedCount:         0,
        outreachCount:         0,
        isOutreachExpensePaid: false,
        outreachExpensePaidAt: null,
        isCollected:           false,
        reportedAt:            null,
      });
      setSelectedId("");
      setCount("0");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 px-4 py-3 border-t border-gray-100 w-full hover:bg-brand-50 transition-colors"
      >
        <UserPlus size={13} />
        団員を追加（{unallocated.length}名未配布）
      </button>
    );
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3 bg-brand-50">
      <p className="text-xs font-medium text-brand-700 mb-2">配布リストに追加</p>
      <div className="flex items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 text-xs border border-brand-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
        >
          <option value="">団員を選択</option>
          {unallocated.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nameJa}{m.part?.name ? `（${m.part.name}）` : ""}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-14 text-xs text-center border border-brand-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
          placeholder="枚数"
        />
        <span className="text-xs text-brand-600">枚</span>
        <button
          onClick={handleAdd}
          disabled={!selectedId || saving}
          className="text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg disabled:opacity-60 transition-colors flex items-center gap-1"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          追加
        </button>
        <button onClick={() => setOpen(false)} aria-label="パネルを閉じる" className="p-1 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
