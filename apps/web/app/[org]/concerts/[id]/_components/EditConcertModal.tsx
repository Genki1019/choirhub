"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  concertsApi,
  type ConcertDetail,
  type ConcertStatus,
  type UpdateConcertInput,
} from "@/lib/concerts-api";
import { LocationSearch } from "@/components/LocationSearch";
import { isoToJstParts } from "@/lib/date";
import { userErrorMessage } from "@/lib/api-client";

interface EditConcertModalProps {
  concert: ConcertDetail;
  orgSlug: string;
  onClose: () => void;
  onSaved: (updated: Partial<ConcertDetail>) => void;
}

const STATUS_OPTIONS: { value: ConcertStatus; label: string }[] = [
  { value: "draft", label: "準備中" },
  { value: "confirmed", label: "確定済み" },
  { value: "past", label: "終了" },
];

const INPUT_CLS =
  "focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none";

export function EditConcertModal({ concert, orgSlug, onClose, onSaved }: EditConcertModalProps) {
  const [form, setForm] = useState<UpdateConcertInput>({
    title: concert.title,
    heldOn: isoToJstParts(concert.heldOn).date,
    venue: concert.venue ?? "",
    status: concert.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.title?.trim()) {
      setError("演奏会名を入力してください");
      return;
    }
    if (!form.heldOn) {
      setError("日付を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await concertsApi.update(orgSlug, concert.id, {
        ...form,
        venue: form.venue?.trim() || null,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, "演奏会情報の保存に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="演奏会情報を編集"
      size="sm"
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
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            保存する
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="concert-title" className="mb-1.5 block text-xs font-medium text-gray-600">
          演奏会名 <span className="text-red-500">*</span>
        </label>
        <input
          id="concert-title"
          value={form.title ?? ""}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={INPUT_CLS}
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="concert-held-on" className="mb-1.5 block text-xs font-medium text-gray-600">
          開催日 <span className="text-red-500">*</span>
        </label>
        <input
          id="concert-held-on"
          type="date"
          value={form.heldOn ?? ""}
          onChange={(e) => setForm({ ...form, heldOn: e.target.value })}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <label htmlFor="concert-venue" className="mb-1.5 block text-xs font-medium text-gray-600">
          会場
        </label>
        <LocationSearch
          id="concert-venue"
          value={form.venue ?? ""}
          placeholder="例: ○○ホール 大ホール"
          inlineSuggestions
          onChangeName={(name) => setForm({ ...form, venue: name })}
          onSelectPlace={(name) => setForm({ ...form, venue: name })}
        />
      </div>
      <div>
        <label htmlFor="concert-status" className="mb-1.5 block text-xs font-medium text-gray-600">
          ステータス
        </label>
        <select
          id="concert-status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as ConcertStatus })}
          className={`${INPUT_CLS} bg-white`}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
