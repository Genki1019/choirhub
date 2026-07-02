"use client";

import { type BatchDetail, type TicketDetail, type AllocationRow } from "@/lib/tickets-api";
import type { MemberProfile } from "@/lib/api-types";
import { comparePartOrder } from "@/lib/voice-order";
import { AllocationRowComponent } from "./AllocationRow";
import { AddMemberPanel } from "./AddMemberPanel";

function RateBar({ sold, allocated }: { sold: number; allocated: number }) {
  const pct   = allocated > 0 ? Math.round((sold / allocated) * 100) : 0;
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-brand-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  );
}

interface BatchTabProps {
  batch: BatchDetail;
  detail: TicketDetail;
  orgSlug: string;
  concertId: string;
  allMembers: MemberProfile[];
  onAllocationUpdated: (allocationId: string, data: Partial<AllocationRow>) => void;
  onMemberAdded: (batchId: string, row: AllocationRow) => void;
}

export function BatchTab({
  batch, detail, orgSlug, concertId, allMembers, onAllocationUpdated, onMemberAdded,
}: BatchTabProps) {
  const { isAdmin, myMemberId } = detail;

  const partMap = new Map<string, { partName: string; sortOrder: number; voiceType: string; rows: AllocationRow[] }>();
  batch.allocations.forEach((row) => {
    const key = row.partId ?? "__none__";
    if (!partMap.has(key)) {
      partMap.set(key, { partName: row.partName ?? "パート未設定", sortOrder: row.partSortOrder, voiceType: row.partVoiceType, rows: [] });
    }
    partMap.get(key)!.rows.push(row);
  });
  const sortedParts = Array.from(partMap.values()).sort((a, b) =>
    comparePartOrder({ voiceType: a.voiceType, sortOrder: a.sortOrder }, { voiceType: b.voiceType, sortOrder: b.sortOrder })
  );

  const totalAllocated = batch.allocations.reduce((s, a) => s + a.allocatedCount, 0);
  const totalSold      = batch.allocations.reduce((s, a) => s + a.soldAdult + a.soldStudent + a.soldOther, 0);
  const totalReturned  = batch.allocations.reduce((s, a) => s + a.returnedCount, 0);
  const collectedCount = batch.allocations.filter((a) => a.isCollected).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "配布枚数", value: `${totalAllocated}枚`, color: "text-gray-800" },
          { label: "販売済み", value: `${totalSold}枚`,      color: "text-brand-600" },
          { label: "返却済み", value: `${totalReturned}枚`,  color: "text-gray-500" },
          { label: "集金完了", value: `${collectedCount}名`, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* テーブル部分: 列固定幅のため横スクロール対応 */}
        <div className="overflow-x-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 min-w-max">
            <span className="w-28 shrink-0">名前</span>
            <span className="w-16 shrink-0">配布</span>
            <span className="w-12 text-center shrink-0">大人</span>
            <span className="w-12 text-center shrink-0">学生</span>
            <span className="w-12 text-center shrink-0">他</span>
            <span className="w-12 text-center shrink-0">返却</span>
            <span className="w-10 text-center shrink-0">残</span>
            <span className="w-10 text-center shrink-0">集金</span>
          </div>

          {sortedParts.map(({ partName, rows }) => (
            <div key={partName}>
              <div className="px-4 py-1.5 bg-gray-50/70 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500">{partName}</p>
              </div>
              {rows.map((row) => (
                <div key={row.id} className="border-b border-gray-100 last:border-0 min-w-max">
                  <AllocationRowComponent
                    row={row}
                    canEdit={isAdmin || row.memberId === myMemberId}
                    canEditAllocation={isAdmin || row.memberId === myMemberId}
                    isAdmin={isAdmin}
                    orgSlug={orgSlug}
                    onUpdated={(data) => onAllocationUpdated(row.id, data)}
                  />
                </div>
              ))}
            </div>
          ))}

          {batch.allocations.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              配布登録されていません
            </div>
          )}
        </div>

        {isAdmin && (
          <AddMemberPanel
            batch={batch}
            orgSlug={orgSlug}
            concertId={concertId}
            allMembers={allMembers}
            onAdded={(row) => onMemberAdded(batch.id, row)}
          />
        )}
      </div>

      {detail.partSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">パート別集計</p>
          </div>
          <div className="divide-y divide-gray-100">
            {detail.partSummary.map((p) => (
              <div key={p.partId} className="flex items-center gap-4 px-5 py-3">
                <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{p.partName}</span>
                <RateBar sold={p.sold} allocated={p.allocated} />
                <span className="text-xs text-gray-500 ml-auto">
                  {p.sold} / {p.allocated}枚
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
