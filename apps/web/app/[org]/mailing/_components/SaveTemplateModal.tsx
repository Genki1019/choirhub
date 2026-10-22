"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { mailingApi } from "@/lib/mailing-api";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

const TEMPLATE_NAME_MAX = 100;

interface SaveTemplateModalProps {
  orgSlug: string;
  subject: string;
  body: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SaveTemplateModal({
  orgSlug,
  subject,
  body,
  onClose,
  onSaved,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("テンプレート名を入力してください");
      return;
    }
    if (!subject.trim()) {
      setError("件名が空です");
      return;
    }
    if (!body.trim()) {
      setError("本文が空です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await mailingApi.templates.save(orgSlug, {
        name: name.trim(),
        subject,
        body,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, "テンプレートの保存に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="テンプレートとして保存"
      size="sm"
      onClose={onClose}
      onSubmit={handleSave}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}保存
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="template-name" className="mb-1.5 block text-xs font-medium text-gray-600">
          テンプレート名 <span className="text-red-500">*</span>
        </label>
        <input
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TEMPLATE_NAME_MAX}
          placeholder="例: 練習案内テンプレート"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          autoFocus
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
