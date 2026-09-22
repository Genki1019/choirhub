"use client";

import { useState, type FormEvent } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { membersApi } from "@/lib/members-api";

interface EmailChangeSectionProps {
  org: string;
  currentEmail: string;
}

export function EmailChangeSection({ org, currentEmail }: EmailChangeSectionProps) {
  const [newEmail, setNewEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await membersApi.requestEmailChange(org, newEmail);
      setSent(true);
    } catch {
      setError("送信に失敗しました。しばらく後でお試しください。");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white px-6 py-5">
      <div className="flex items-center gap-2">
        <Mail size={15} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">アカウント設定</h2>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">現在のメールアドレス</p>
        <p className="text-sm text-gray-700">{currentEmail}</p>
      </div>

      {sent ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
          <CheckCircle size={14} />
          {newEmail} 宛に確認メールを送信しました。リンクをクリックして変更を完了してください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="new-email" className="mb-1 block text-xs font-medium text-gray-500">
              新しいメールアドレス
            </label>
            <input
              id="new-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="example@mail.com"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {sending && <Loader2 size={13} className="animate-spin" />}
            確認メールを送信
          </button>
        </form>
      )}
    </div>
  );
}
