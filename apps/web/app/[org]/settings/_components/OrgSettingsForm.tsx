"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";

interface OrgSettingsFormProps {
  orgSlug: string;
  initialName: string;
  initialSlug: string;
}

export function OrgSettingsForm({ orgSlug, initialName, initialSlug }: OrgSettingsFormProps) {
  const [orgName, setOrgName] = useState(initialName);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

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
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-5">
      <h2 className="text-sm font-semibold text-gray-700">基本情報</h2>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">団体名</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">スラッグ（URL）</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">choirhub.app/</span>
          <input
            type="text"
            value={initialSlug}
            readOnly
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-default"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">スラッグの変更はサポートへお問い合わせください。</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-teal-600">
            <CheckCircle size={12} />
            保存しました
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          保存する
        </button>
      </div>
    </form>
  );
}
