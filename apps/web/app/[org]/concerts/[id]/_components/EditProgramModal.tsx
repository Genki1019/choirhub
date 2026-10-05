"use client";

import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { concertsApi, type ProgramDetail } from "@/lib/concerts-api";
import { userErrorMessage } from "@/lib/api-client";

interface EditProgramModalProps {
  orgSlug: string;
  concertId: string;
  program: ProgramDetail;
  onClose: () => void;
  onSaved: (updated: ProgramDetail) => void;
}

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

export function EditProgramModal({
  orgSlug,
  concertId,
  program,
  onClose,
  onSaved,
}: EditProgramModalProps) {
  const [title, setTitle] = useState(program.title);
  const [composer, setComposer] = useState(program.score?.composer ?? "");
  const [arranger, setArranger] = useState(program.score?.arranger ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("曲名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await concertsApi.updateProgram(orgSlug, concertId, program.id, {
        title: title.trim(),
        composer: composer.trim() || null,
        arranger: arranger.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(userErrorMessage(err, "曲目の保存に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="曲目を編集"
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
        <label htmlFor="program-title" className="mb-1.5 block text-xs font-medium text-gray-600">
          曲名 <span className="text-red-500">*</span>
        </label>
        <input
          id="program-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT_CLS}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="program-composer"
            className="mb-1.5 block text-xs font-medium text-gray-600"
          >
            作曲者
          </label>
          <input
            id="program-composer"
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="例: 山田 花子"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label
            htmlFor="program-arranger"
            className="mb-1.5 block text-xs font-medium text-gray-600"
          >
            編曲者
          </label>
          <input
            id="program-arranger"
            value={arranger}
            onChange={(e) => setArranger(e.target.value)}
            placeholder="例: 田中 二郎"
            className={INPUT_CLS}
          />
        </div>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
