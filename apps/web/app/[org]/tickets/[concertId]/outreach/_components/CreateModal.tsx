"use client";

import { useState, type FormEvent } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";
import { userErrorMessage } from "@/lib/api-client";
import type { MemberProfile } from "@/lib/api-types";
import { todayStr } from "@/lib/date";

interface ParticipantEntry {
  memberId: string;
  ticketsSold: number;
  expense: number | "";
}

function ParticipantRow({
  index,
  members,
  entry,
  onChange,
  onRemove,
}: {
  index: number;
  members: MemberProfile[];
  entry: ParticipantEntry;
  onChange: (v: ParticipantEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_56px_72px_28px] items-center gap-2">
      <select
        aria-label={`参加者${index}の団員`}
        value={entry.memberId}
        onChange={(e) => onChange({ ...entry, memberId: e.target.value })}
        className="focus:ring-brand-400 w-full min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:outline-none"
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
        aria-label={`参加者${index}の販売枚数`}
        value={entry.ticketsSold}
        onChange={(e) => onChange({ ...entry, ticketsSold: Math.max(0, Number(e.target.value)) })}
        className="focus:ring-brand-400 w-full min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm focus:ring-2 focus:outline-none"
      />
      <input
        type="number"
        min={0}
        placeholder="交通費"
        aria-label={`参加者${index}の交通費（円）`}
        value={entry.expense}
        onChange={(e) =>
          onChange({
            ...entry,
            expense: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
          })
        }
        className="focus:ring-brand-400 w-full min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm focus:ring-2 focus:outline-none"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`参加者${index}を削除`}
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
  const [activityDate, setActivityDate] = useState(todayStr);
  const [note, setNote] = useState("");
  const [participants, setParticipants] = useState<ParticipantEntry[]>([
    { memberId: "", ticketsSold: 0, expense: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const addRow = () =>
    setParticipants((prev) => [...prev, { memberId: "", ticketsSold: 0, expense: "" }]);
  const updateRow = (i: number, v: ParticipantEntry) =>
    setParticipants((prev) => prev.map((r, idx) => (idx === i ? v : r)));
  const removeRow = (i: number) => setParticipants((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setAttempt((n) => n + 1);
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
    } catch (err) {
      setError(userErrorMessage(err, "情宣活動の申請に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="情宣活動を申請"
      size="lg"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            申請する
          </button>
        </>
      }
    >
      <div>
        <label
          htmlFor="outreach-destination"
          className="mb-1 block text-xs font-medium text-gray-500"
        >
          行き先 <span className="text-red-500">*</span>
        </label>
        <input
          id="outreach-destination"
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="例: 渋谷駅前、新宿西口"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="outreach-date" className="mb-1 block text-xs font-medium text-gray-500">
          活動日 <span className="text-red-500">*</span>
        </label>
        <input
          id="outreach-date"
          type="date"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="outreach-note" className="mb-1 block text-xs font-medium text-gray-500">
          メモ（任意）
        </label>
        <input
          id="outreach-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="備考・コメント"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
      </div>
      <fieldset>
        <legend className="mb-1 block text-xs font-medium text-gray-500">
          参加者 <span className="text-red-500">*</span>
        </legend>
        <div
          aria-hidden="true"
          className="mb-1 grid grid-cols-[minmax(0,1fr)_56px_72px_28px] gap-2 pr-1 text-[10px] text-gray-400"
        >
          <span />
          <span className="text-center">販売枚数</span>
          <span className="text-center">交通費(円)</span>
        </div>
        <div className="space-y-2">
          {participants.map((p, i) => (
            <ParticipantRow
              key={i}
              index={i + 1}
              members={members}
              entry={p}
              onChange={(v) => updateRow(i, v)}
              onRemove={() => removeRow(i)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="text-brand-600 hover:text-brand-800 mt-2 flex items-center gap-1 text-xs"
        >
          <Plus size={12} /> 参加者を追加
        </button>
      </fieldset>
      <ErrorMessage key={attempt}>{error}</ErrorMessage>
    </Modal>
  );
}
