"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";

interface OrgSettingsFormProps {
  orgSlug: string;
  initialName: string;
  initialSlug: string;
  canEdit: boolean;
}

export function OrgSettingsForm({
  orgSlug,
  initialName,
  initialSlug,
  canEdit,
}: OrgSettingsFormProps) {
  const [orgName, setOrgName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await settingsApi.update(orgSlug, { name: orgName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="space-y-5 rounded-xl border border-gray-200 bg-white px-6 py-5"
    >
      <h2 className="text-sm font-semibold text-gray-700">基本情報</h2>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500">団体名</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          readOnly={!canEdit}
          className={
            canEdit
              ? "focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              : "w-full cursor-default rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500">スラッグ（URL）</label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-gray-400">choirhub.app/</span>
          <input
            type="text"
            value={initialSlug}
            readOnly
            className="flex-1 cursor-default rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          スラッグの変更はサポートへお問い合わせください。
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {canEdit ? (
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-teal-600">
              <CheckCircle size={12} />
              保存しました
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            保存する
          </button>
        </div>
      ) : (
        <p className="border-t border-gray-100 pt-2 text-xs text-gray-400">
          団体名の変更には管理者権限が必要です。
        </p>
      )}
    </form>
  );
}
