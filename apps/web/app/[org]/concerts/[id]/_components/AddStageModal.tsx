"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { concertsApi, type AddStageInput, type StageDetail } from "@/lib/concerts-api";
import { userErrorMessage } from "@/lib/api-client";

interface AddStageModalProps {
  orgSlug: string;
  concertId: string;
  stageCount: number;
  onClose: () => void;
  onCreated: (stage: StageDetail) => void;
}

export function AddStageModal({
  orgSlug,
  concertId,
  stageCount,
  onClose,
  onCreated,
}: AddStageModalProps) {
  const [form, setForm] = useState<AddStageInput>({ name: `第${stageCount + 1}ステージ` });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("ステージ名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await concertsApi.addStage(orgSlug, concertId, form);
      onCreated(created);
    } catch (err) {
      setError(userErrorMessage(err, "ステージの追加に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="ステージを追加"
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
            追加する
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="stage-name" className="mb-1.5 block text-xs font-medium text-gray-600">
          ステージ名 <span className="text-red-500">*</span>
        </label>
        <input
          id="stage-name"
          value={form.name}
          onChange={(e) => setForm({ name: e.target.value })}
          placeholder="例: 第1ステージ（委嘱作品）"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
