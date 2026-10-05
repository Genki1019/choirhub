"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { concertsApi, type SurveySummary } from "@/lib/concerts-api";
import { userErrorMessage } from "@/lib/api-client";

interface CreateSurveyModalProps {
  orgSlug: string;
  concertId: string;
  surveyCount: number;
  onClose: () => void;
  onCreated: (survey: SurveySummary) => void;
}

export function CreateSurveyModal({
  orgSlug,
  concertId,
  surveyCount,
  onClose,
  onCreated,
}: CreateSurveyModalProps) {
  const ordinal = ["一次", "二次", "三次", "四次", "五次"][surveyCount] ?? `第${surveyCount + 1}次`;
  const [title, setTitle] = useState(`${ordinal}調査`);
  const [closeDate, setCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await concertsApi.createSurvey(orgSlug, concertId, {
        title: title.trim(),
        closeAt: closeDate ? `${closeDate}T23:59:00+09:00` : null,
      });
      onCreated(created);
    } catch (err) {
      setError(userErrorMessage(err, "調査の開設に失敗しました。もう一度お試しください。"));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="調査を開設する"
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
            開設する
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="survey-title" className="mb-1.5 block text-xs font-medium text-gray-600">
          調査タイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="survey-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      </div>
      <div>
        <label
          htmlFor="survey-close-date"
          className="mb-1.5 block text-xs font-medium text-gray-600"
        >
          回答締切日（任意）
        </label>
        <input
          id="survey-close-date"
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
