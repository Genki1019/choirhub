"use client";

import { useState } from "react";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { ticketsApi, type AllocationRow } from "@/lib/tickets-api";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

interface AllocationRowProps {
  row: AllocationRow;
  orgSlug: string;
  onUpdated: (updated: Partial<AllocationRow>) => void;
}

export function AllocationRowComponent({ row, orgSlug, onUpdated }: AllocationRowProps) {
  const [editing, setEditing] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(false);
  const [form, setForm] = useState({
    soldAdult: row.soldAdult,
    soldStudent: row.soldStudent,
    soldOther: row.soldOther,
    returnedCount: row.returnedCount,
    isCollected: row.isCollected,
  });
  const [allocCount, setAllocCount] = useState(row.allocatedCount);
  const [saving, setSaving] = useState(false);
  const [savingAlloc, setSavingAlloc] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);

  const totalSold = row.soldAdult + row.soldStudent + row.soldOther;
  const remaining = row.allocatedCount - totalSold - row.returnedCount;

  const handleSave = async () => {
    setSaving(true);
    setSalesError(null);
    try {
      await ticketsApi.updateAllocation(orgSlug, row.id, form);
      onUpdated(form);
      setEditing(false);
    } catch (err) {
      setSalesError(
        userErrorMessage(err, "販売状況の保存に失敗しました。もう一度お試しください。"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAlloc = async () => {
    setSavingAlloc(true);
    setAllocError(null);
    try {
      await ticketsApi.updateAllocation(orgSlug, row.id, { allocatedCount: allocCount });
      onUpdated({ allocatedCount: allocCount, requestedCount: null });
      setEditingAlloc(false);
    } catch (err) {
      setAllocError(
        userErrorMessage(err, "配布枚数の保存に失敗しました。もう一度お試しください。"),
      );
    } finally {
      setSavingAlloc(false);
    }
  };

  const handleCancel = () => {
    setForm({
      soldAdult: row.soldAdult,
      soldStudent: row.soldStudent,
      soldOther: row.soldOther,
      returnedCount: row.returnedCount,
      isCollected: row.isCollected,
    });
    setEditing(false);
    setSalesError(null);
  };

  return (
    <div className={`${editing ? "bg-brand-50" : "hover:bg-gray-50"} transition-colors`}>
      <div className="flex items-center gap-3 px-4 py-3 text-sm">
        <div className="w-28 shrink-0">
          <p className="text-xs font-medium text-gray-800">{row.nameJa}</p>
          <p className="text-xs text-gray-400">{row.partName ?? "—"}</p>
        </div>

        <div className="w-16 shrink-0">
          {editingAlloc ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                aria-label={`${row.nameJa}の配布数`}
                value={allocCount}
                onChange={(e) => setAllocCount(Number(e.target.value))}
                className="border-brand-300 focus:ring-brand-400 w-10 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveAlloc}
                disabled={savingAlloc}
                aria-label="配布数を保存"
                className="text-brand-600 hover:text-brand-700 p-0.5 disabled:opacity-60"
              >
                {savingAlloc ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              </button>
              <button
                onClick={() => {
                  setAllocCount(row.allocatedCount);
                  setEditingAlloc(false);
                  setAllocError(null);
                }}
                disabled={savingAlloc}
                aria-label="配布数の編集をキャンセル"
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-1">
              <span className="text-sm text-gray-700">{row.allocatedCount}</span>
              {row.requestedCount !== null && row.requestedCount !== row.allocatedCount && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs leading-none text-amber-600">
                  申請{row.requestedCount}
                </span>
              )}
              <button
                onClick={() => {
                  setAllocCount(row.allocatedCount);
                  setEditingAlloc(true);
                }}
                aria-label={`${row.nameJa}の配布数を編集`}
                className="hover:text-brand-500 p-0.5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Pencil size={10} />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <>
            <input
              type="number"
              min={0}
              aria-label={`${row.nameJa}の大人販売数`}
              value={form.soldAdult}
              onChange={(e) => setForm({ ...form, soldAdult: Number(e.target.value) })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              aria-label={`${row.nameJa}の学生販売数`}
              value={form.soldStudent}
              onChange={(e) => setForm({ ...form, soldStudent: Number(e.target.value) })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              aria-label={`${row.nameJa}の他販売数`}
              value={form.soldOther}
              onChange={(e) => setForm({ ...form, soldOther: Number(e.target.value) })}
              className="border-brand-300 focus:ring-brand-400 w-12 rounded border px-1 py-0.5 text-center text-sm focus:ring-1 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              aria-label={`${row.nameJa}の返却数`}
              value={form.returnedCount}
              onChange={(e) => setForm({ ...form, returnedCount: Number(e.target.value) })}
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
          {!editing && (
            <button
              onClick={() => {
                setForm({
                  soldAdult: row.soldAdult,
                  soldStudent: row.soldStudent,
                  soldOther: row.soldOther,
                  returnedCount: row.returnedCount,
                  isCollected: row.isCollected,
                });
                setEditing(true);
              }}
              aria-label={`${row.nameJa}の販売状況を編集`}
              className="hover:text-brand-500 hover:bg-brand-50 rounded-lg p-1.5 text-gray-400 transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                保存
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                aria-label="編集をキャンセル"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      <ErrorMessage className="mx-4 mb-3">{allocError}</ErrorMessage>
      <ErrorMessage className="mx-4 mb-3">{salesError}</ErrorMessage>
    </div>
  );
}
