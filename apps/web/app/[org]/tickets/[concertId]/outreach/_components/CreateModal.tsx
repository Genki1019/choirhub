"use client";

import { useState } from "react";
import { Plus, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";
import type { MemberProfile } from "@/lib/api-types";

interface ParticipantEntry {
  memberId: string;
  ticketsSold: number;
  expense: number | "";
}

function ParticipantRow({
  members,
  entry,
  onChange,
  onRemove,
}: {
  members: MemberProfile[];
  entry: ParticipantEntry;
  onChange: (v: ParticipantEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_64px_80px_32px] items-center gap-2">
      <select
        value={entry.memberId}
        onChange={(e) => onChange({ ...entry, memberId: e.target.value })}
        className="focus:ring-brand-400 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
      >
        <option value="">-- 選択 --</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            [{m.part?.name ?? "未"}] {m.nameJa}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        placeholder="枚数"
        value={entry.ticketsSold}
        onChange={(e) => onChange({ ...entry, ticketsSold: Math.max(0, Number(e.target.value)) })}
        className="focus:ring-brand-400 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm focus:ring-2 focus:outline-none"
      />
      <input
        type="number"
        min={0}
        placeholder="交通費"
        value={entry.expense}
        onChange={(e) =>
          onChange({
            ...entry,
            expense: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
          })
        }
        className="focus:ring-brand-400 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm focus:ring-2 focus:outline-none"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="参加者を削除"
        className="text-gray-300 transition-colors hover:text-red-400"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

interface CreateModalProps {
  orgSlug: string;
  concertId: string;
  members: MemberProfile[];
  onClose: () => void;
  onCreated: (a: OutreachActivityRow) => void;
}

export function CreateModal({ orgSlug, concertId, members, onClose, onCreated }: CreateModalProps) {
  const [destination, setDestination] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [participants, setParticipants] = useState<ParticipantEntry[]>([
    { memberId: "", ticketsSold: 0, expense: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () =>
    setParticipants((prev) => [...prev, { memberId: "", ticketsSold: 0, expense: "" }]);
  const updateRow = (i: number, v: ParticipantEntry) =>
    setParticipants((prev) => prev.map((r, idx) => (idx === i ? v : r)));
  const removeRow = (i: number) => setParticipants((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(null);
    const valid = participants.filter((p) => p.memberId);
    if (!destination.trim()) {
      setError("行き先を入力してください");
      return;
    }
    if (valid.length === 0) {
      setError("参加者を1人以上選択してください");
      return;
    }

    const seen = new Set<string>();
    for (const p of valid) {
      if (seen.has(p.memberId)) {
        setError("同じ団員が重複しています");
        return;
      }
      seen.add(p.memberId);
    }

    setSaving(true);
    try {
      const result = await ticketsApi.createOutreachActivity(orgSlug, concertId, {
        destination: destination.trim(),
        activityDate,
        note: note.trim() || undefined,
        participants: valid.map((p) => ({
          memberId: p.memberId,
          ticketsSold: p.ticketsSold,
          expense: p.expense === "" ? undefined : p.expense,
        })),
      });
      onCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4">
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">情宣活動を申請</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              行き先 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="例: 渋谷駅前、新宿西口"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              活動日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">メモ（任意）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備考・コメント"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              参加者 <span className="text-red-500">*</span>
            </label>
            <div className="overflow-x-auto">
              <div className="min-w-[340px]">
                <div className="mb-1 grid grid-cols-[1fr_64px_80px_32px] gap-2 pr-1 text-[10px] text-gray-400">
                  <span />
                  <span className="text-center">販売枚数</span>
                  <span className="text-center">交通費(円)</span>
                </div>
                <div className="space-y-2">
                  {participants.map((p, i) => (
                    <ParticipantRow
                      key={i}
                      members={members}
                      entry={p}
                      onChange={(v) => updateRow(i, v)}
                      onRemove={() => removeRow(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="text-brand-600 hover:text-brand-800 mt-2 flex items-center gap-1 text-xs"
            >
              <Plus size={12} /> 参加者を追加
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            申請する
          </button>
        </div>
      </div>
    </div>
  );
}
