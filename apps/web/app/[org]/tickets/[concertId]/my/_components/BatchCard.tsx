"use client";

import { useState } from "react";
import { Check, Loader2, Clock } from "lucide-react";
import { ticketsApi, type MyAllocationBatch } from "@/lib/tickets-api";
import { AmountSummary } from "./AmountSummary";
import { Stepper } from "./Stepper";

function yen(amount: number) {
  return `¥${amount.toLocaleString()}`;
}

interface BatchCardProps {
  batch: MyAllocationBatch;
  orgSlug: string;
  concertId: string;
  isClosed: boolean;
  onChange: (updated: Partial<MyAllocationBatch>) => void;
}

export function BatchCard({ batch, orgSlug, concertId, isClosed, onChange }: BatchCardProps) {
  const [reqCount, setReqCount] = useState(batch.requestedCount ?? batch.allocatedCount);
  const [sales, setSales] = useState({
    soldAdult:     batch.soldAdult,
    soldStudent:   batch.soldStudent,
    returnedCount: batch.returnedCount,
  });
  const [savingReq,   setSavingReq]   = useState(false);
  const [savingSales, setSavingSales] = useState(false);
  const [savedMsg,    setSavedMsg]    = useState<string | null>(null);

  const soldTotal = sales.soldAdult + sales.soldStudent;
  const hasPendingRequest = batch.requestedCount !== null && batch.requestedCount !== batch.allocatedCount;
  const reqChanged = reqCount !== (batch.requestedCount ?? batch.allocatedCount);

  const flash = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleRequestSubmit = async () => {
    setSavingReq(true);
    try {
      const result = await ticketsApi.allocate(orgSlug, concertId, {
        batchId: batch.batchId,
        allocatedCount: reqCount,
      });
      onChange({ requestedCount: result.requestedCount });
      flash("申請を送信しました");
    } finally {
      setSavingReq(false);
    }
  };

  const handleSalesSubmit = async () => {
    setSavingSales(true);
    try {
      await ticketsApi.updateAllocation(orgSlug, batch.allocationId, { ...sales, soldOther: 0 });
      onChange({ ...sales, soldOther: 0, reportedAt: new Date().toISOString() });
      flash("販売状況を更新しました");
    } finally {
      setSavingSales(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div>
          <span className="font-semibold text-gray-800">{batch.batchName}</span>
          <span className="ml-2 text-sm text-gray-400">
            一般{yen(batch.price)}
            {batch.priceStudent != null && ` / 学生${yen(batch.priceStudent)}`}
          </span>
        </div>
        {savedMsg && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <Check size={12} />
            {savedMsg}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 space-y-5">
        <div className="pt-4">
          <AmountSummary
            allocatedCount={batch.allocatedCount}
            soldAdult={batch.soldAdult}
            soldStudent={batch.soldStudent}
            returnedCount={batch.returnedCount}
            price={batch.price}
            priceStudent={batch.priceStudent}
          />
        </div>

        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">希望枚数の変更申請</p>
            {hasPendingRequest && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                <Clock size={10} />
                申請中: {batch.requestedCount}枚（承認待ち）
              </span>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">現在の配布枚数</span>
              <span className="text-sm font-semibold text-gray-800">
                {batch.allocatedCount}枚 <span className="text-gray-400 font-normal">（{yen(batch.allocatedCount * batch.price)}）</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">希望枚数</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setReqCount(Math.max(0, reqCount - 1))} disabled={isClosed}
                  className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-white text-xl leading-none flex items-center justify-center transition-colors select-none disabled:opacity-40">
                  −
                </button>
                <input
                  type="number" min={0} value={reqCount} disabled={isClosed}
                  onChange={(e) => setReqCount(Math.max(0, Number(e.target.value)))}
                  className="w-14 text-center text-sm font-medium border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button type="button" onClick={() => setReqCount(reqCount + 1)} disabled={isClosed}
                  className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-white text-xl leading-none flex items-center justify-center transition-colors select-none disabled:opacity-40">
                  ＋
                </button>
              </div>
            </div>
            <button
              onClick={handleRequestSubmit}
              disabled={isClosed || savingReq || !reqChanged}
              className="mt-3 w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {savingReq && <Loader2 size={13} className="animate-spin" />}
              変更を申請する
            </button>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">販売状況の報告</p>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <Stepper label="大人" value={sales.soldAdult}     disabled={isClosed} onChange={(v) => setSales({ ...sales, soldAdult: v })} />
            <Stepper label="学生" value={sales.soldStudent}   disabled={isClosed} onChange={(v) => setSales({ ...sales, soldStudent: v })} />
            <Stepper label="返却" value={sales.returnedCount} disabled={isClosed} onChange={(v) => setSales({ ...sales, returnedCount: v })} />
            {soldTotal > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50">
                <span className="text-xs text-blue-600">販売金額 合計</span>
                <span className="text-sm font-semibold text-blue-700">
                  {yen(sales.soldAdult * batch.price + sales.soldStudent * (batch.priceStudent ?? batch.price))}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleSalesSubmit}
            disabled={isClosed || savingSales}
            className="mt-3 w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {savingSales && <Loader2 size={13} className="animate-spin" />}
            販売状況を確定
          </button>
          {batch.reportedAt && (
            <p className="text-center text-xs text-gray-400 mt-1.5">
              最終報告: {new Date(batch.reportedAt).toLocaleDateString("ja-JP")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
