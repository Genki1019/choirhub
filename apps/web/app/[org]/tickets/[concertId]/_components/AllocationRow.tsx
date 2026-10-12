"use client";

import { Check, X, Loader2 } from "lucide-react";
import { ticketsApi, type AllocationRow } from "@/lib/tickets-api";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { useInlineEdit } from "@/hooks/useInlineEdit";

const isCount = (value: string) => /^\d+$/.test(value.trim());
const COUNT_FIELDS = ["soldAdult", "soldStudent", "soldOther", "returnedCount"] as const;
type SalesForm = Record<(typeof COUNT_FIELDS)[number], string> & { isCollected: boolean };

const toSales = (form: SalesForm) => ({
  soldAdult: Number(form.soldAdult),
  soldStudent: Number(form.soldStudent),
  soldOther: Number(form.soldOther),
  returnedCount: Number(form.returnedCount),
  isCollected: form.isCollected,
});

interface AllocationRowProps {
  row: AllocationRow;
  orgSlug: string;
  onUpdated: (updated: Partial<AllocationRow>) => void;
}

export function AllocationRowComponent({ row, orgSlug, onUpdated }: AllocationRowProps) {
  const { registerTrigger: registerAllocTrigger, ...alloc } = useInlineEdit({
    initial: () => String(row.allocatedCount),
    validate: (count) => (isCount(count) ? null : "配布数は0以上の整数で入力してください"),
    isEqual: (a, b) => Number(a) === Number(b),
    onSave: async (count) => {
      const allocatedCount = Number(count);
      await ticketsApi.updateAllocation(orgSlug, row.id, { allocatedCount });
      onUpdated({ allocatedCount, requestedCount: null });
    },
    errorFallback: "配布枚数の保存に失敗しました。もう一度お試しください。",
  });
  const { registerTrigger: registerSalesTrigger, ...sales } = useInlineEdit({
    initial: (): SalesForm => ({
      soldAdult: String(row.soldAdult),
      soldStudent: String(row.soldStudent),
      soldOther: String(row.soldOther),
      returnedCount: String(row.returnedCount),
      isCollected: row.isCollected,
    }),
    validate: (form) =>
      COUNT_FIELDS.every((key) => isCount(form[key]))
        ? null
        : "枚数は0以上の整数で入力してください",
    isEqual: (a, b) => JSON.stringify(toSales(a)) === JSON.stringify(toSales(b)),
    onSave: async (form) => {
      const sales = toSales(form);
      await ticketsApi.updateAllocation(orgSlug, row.id, sales);
      onUpdated(sales);
    },
    errorFallback: "販売状況の保存に失敗しました。もう一度お試しください。",
  });
  const editing = sales.editing;
  const form = sales.value;
  const setForm = sales.setValue;

  const totalSold = row.soldAdult + row.soldStudent + row.soldOther;
  const remaining = row.allocatedCount - totalSold - row.returnedCount;

  return (
    <div className={`${editing ? "bg-brand-50" : "hover:bg-gray-50"} transition-colors`}>
      <div className="flex items-center gap-3 px-4 py-3 text-sm">
        <div className="w-28 shrink-0">
          <p className="text-xs font-medium text-gray-800">{row.nameJa}</p>
          <p className="text-xs text-gray-400">{row.partName ?? "—"}</p>
        </div>

        <div className="w-16 shrink-0">
          {alloc.editing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label={`${row.nameJa}の配布数`}
                value={alloc.value}
                onChange={(e) => alloc.setValue(e.target.value)}
                onKeyDown={alloc.handleKeyDown}
                className="border-brand-300 focus:ring-brand-400 w-10 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
                autoFocus
              />
              <InlineEditActions
                label={`${row.nameJa}の配布数`}
                size="sm"
                saving={alloc.saving}
                onSave={alloc.save}
                onCancel={alloc.cancel}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-700">{row.allocatedCount}</span>
              {row.requestedCount !== null && row.requestedCount !== row.allocatedCount && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs leading-none text-amber-600">
                  申請{row.requestedCount}
                </span>
              )}
              <InlineEditButton
                ref={registerAllocTrigger}
                label={`${row.nameJa}の配布数`}
                size="sm"
                onClick={alloc.start}
              />
            </div>
          )}
        </div>

        {editing ? (
          <>
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${row.nameJa}の大人販売数`}
              autoFocus
              onKeyDown={sales.handleKeyDown}
              value={form.soldAdult}
              onChange={(e) => setForm({ ...form, soldAdult: e.target.value })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${row.nameJa}の学生販売数`}
              onKeyDown={sales.handleKeyDown}
              value={form.soldStudent}
              onChange={(e) => setForm({ ...form, soldStudent: e.target.value })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${row.nameJa}の他販売数`}
              onKeyDown={sales.handleKeyDown}
              value={form.soldOther}
              onChange={(e) => setForm({ ...form, soldOther: e.target.value })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${row.nameJa}の返却数`}
              onKeyDown={sales.handleKeyDown}
              value={form.returnedCount}
              onChange={(e) => setForm({ ...form, returnedCount: e.target.value })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
          </>
        ) : (
          <>
            <div className="w-12 text-center text-sm text-gray-700">{row.soldAdult || "—"}</div>
            <div className="w-12 text-center text-sm text-gray-700">{row.soldStudent || "—"}</div>
            <div className="w-12 text-center text-sm text-gray-700">{row.soldOther || "—"}</div>
            <div className="w-12 text-center text-sm text-gray-700">{row.returnedCount || "—"}</div>
          </>
        )}

        <div
          className={`w-10 shrink-0 text-center text-sm ${remaining < 0 ? "font-medium text-red-500" : "text-gray-500"}`}
        >
          {remaining}
        </div>

        <div className="w-10 shrink-0 text-center">
          {editing ? (
            <input
              type="checkbox"
              aria-label={`${row.nameJa}の集金済み`}
              checked={form.isCollected}
              onChange={(e) => setForm({ ...form, isCollected: e.target.checked })}
              className="accent-brand-600 h-4 w-4"
            />
          ) : row.isCollected ? (
            <Check size={14} className="mx-auto text-green-500" />
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <button
                type="button"
                onClick={sales.save}
                disabled={sales.saving}
                aria-label={`${row.nameJa}の販売状況を保存`}
                className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              >
                {sales.saving ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Check size={11} />
                )}
                保存
              </button>
              <button
                type="button"
                onClick={sales.cancel}
                disabled={sales.saving}
                aria-label={`${row.nameJa}の販売状況の編集をキャンセル`}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <InlineEditButton
              ref={registerSalesTrigger}
              label={`${row.nameJa}の販売状況`}
              onClick={sales.start}
            />
          )}
        </div>
      </div>
      <ErrorMessage className="mx-4 mb-3">{alloc.error}</ErrorMessage>
      <ErrorMessage className="mx-4 mb-3">{sales.error}</ErrorMessage>
    </div>
  );
}
