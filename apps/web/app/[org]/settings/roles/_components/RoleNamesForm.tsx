"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ROLES, ROLE_LABELS, type RoleKey } from "@/lib/roles";

const DEFAULT_NAMES = { ...ROLE_LABELS } as Record<RoleKey, string>;

interface RoleNamesFormProps {
  orgSlug: string;
  initialNames: Record<RoleKey, string>;
}

export function RoleNamesForm({ orgSlug, initialNames }: RoleNamesFormProps) {
  const [names,  setNames]  = useState<Record<RoleKey, string>>({ ...DEFAULT_NAMES, ...initialNames });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await settingsApi.update(orgSlug, { roleNames: names });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">ロール表示名のカスタマイズ</p>
        <p className="text-xs text-gray-400 mt-0.5">システム権限は変更できません。アプリ内での表示名のみ変更可能です。</p>
      </div>

      {/* ヘッダー行：sm以上のみ表示 */}
      <div className="hidden sm:grid sm:grid-cols-[120px_1fr_160px] px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400">
        <span>システム名</span>
        <span>主な権限</span>
        <span>表示名</span>
      </div>

      <div className="divide-y divide-gray-100">
        {ROLES.map(({ key, description, defaultName }) => (
          <div key={key} className="flex flex-col sm:grid sm:grid-cols-[120px_1fr_160px] sm:items-center px-5 py-3 gap-2 sm:gap-3">
            <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono w-fit">
              {key}
            </code>
            <span className="text-xs text-gray-500 leading-relaxed">{description}</span>
            <div>
              <p className="text-xs text-gray-400 mb-1 sm:hidden">表示名</p>
              <input
                type="text"
                value={names[key]}
                onChange={(e) => setNames((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={defaultName}
                className="w-full sm:w-auto border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
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
