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
    soldAdult: batch.soldAdult,
    soldStudent: batch.soldStudent,
    returnedCount: batch.returnedCount,
  });
  const [savingReq, setSavingReq] = useState(false);
  const [savingSales, setSavingSales] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const soldTotal = sales.soldAdult + sales.soldStudent;
  const hasPendingRequest =
    batch.requestedCount !== null && batch.requestedCount !== batch.allocatedCount;
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
        <div>
          <span className="font-semibold text-gray-800">{batch.batchName}</span>
          <span className="ml-2 text-sm text-gray-400">
            一般{yen(batch.price)}
            {batch.priceStudent != null && ` / 学生${yen(batch.priceStudent)}`}
          </span>
        </div>
        {savedMsg && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
            <Check size={12} />
            {savedMsg}
          </span>
        )}
      </div>

      <div className="space-y-5 px-5 pb-5">
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
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              希望枚数の変更申請
            </p>
            {hasPendingRequest && (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                <Clock size={10} />
                申請中: {batch.requestedCount}枚（承認待ち）
              </span>
            )}
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">現在の配布枚数</span>
              <span className="text-sm font-semibold text-gray-800">
                {batch.allocatedCount}枚{" "}
                <span className="font-normal text-gray-400">
                  （{yen(batch.allocatedCount * batch.price)}）
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">希望枚数</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReqCount(Math.max(0, reqCount - 1))}
                  disabled={isClosed}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-xl leading-none text-gray-500 transition-colors select-none hover:bg-white disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={reqCount}
                  disabled={isClosed}
                  onChange={(e) => setReqCount(Math.max(0, Number(e.target.value)))}
                  className="focus:ring-brand-400 w-14 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-medium focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setReqCount(reqCount + 1)}
                  disabled={isClosed}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-xl leading-none text-gray-500 transition-colors select-none hover:bg-white disabled:opacity-40"
                >
                  ＋
                </button>
              </div>
            </div>
            <button
              onClick={handleRequestSubmit}
              disabled={isClosed || savingReq || !reqChanged}
              className="bg-brand-600 hover:bg-brand-700 mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {savingReq && <Loader2 size={13} className="animate-spin" />}
              変更を申請する
            </button>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            販売状況の報告
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <Stepper
              label="大人"
              value={sales.soldAdult}
              disabled={isClosed}
              onChange={(v) => setSales({ ...sales, soldAdult: v })}
            />
            <Stepper
              label="学生"
              value={sales.soldStudent}
              disabled={isClosed}
              onChange={(v) => setSales({ ...sales, soldStudent: v })}
            />
            <Stepper
              label="返却"
              value={sales.returnedCount}
              disabled={isClosed}
              onChange={(v) => setSales({ ...sales, returnedCount: v })}
            />
            {soldTotal > 0 && (
              <div className="bg-brand-50 flex items-center justify-between px-4 py-2.5">
                <span className="text-brand-600 text-xs">販売金額 合計</span>
                <span className="text-brand-700 text-sm font-semibold">
                  {yen(
                    sales.soldAdult * batch.price +
                      sales.soldStudent * (batch.priceStudent ?? batch.price),
                  )}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleSalesSubmit}
            disabled={isClosed || savingSales}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {savingSales && <Loader2 size={13} className="animate-spin" />}
            販売状況を確定
          </button>
          {batch.reportedAt && (
            <p className="mt-1.5 text-center text-xs text-gray-400">
              最終報告: {new Date(batch.reportedAt).toLocaleDateString("ja-JP")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
