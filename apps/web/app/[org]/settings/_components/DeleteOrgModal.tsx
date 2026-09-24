"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

interface DeleteOrgModalProps {
  orgSlug: string;
  orgName: string;
  onClose: () => void;
}

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiClientError && err.status < 500) return err.message;
  return "削除に失敗しました。もう一度お試しください。";
}

export function DeleteOrgModal({ orgSlug, orgName, onClose }: DeleteOrgModalProps) {
  const router = useRouter();
  const titleId = useId();
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmName === orgName && password.length > 0 && !deleting;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleting, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setDeleting(true);
    setError(null);
    try {
      await settingsApi.deleteOrg(orgSlug, { confirmName, password });
      router.replace("/select-org");
    } catch (err) {
      setError(errorMessageFor(err));
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div>
            <p id={titleId} className="font-semibold text-gray-800">
              団体を削除しますか？
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-500">
              <li>すべての団員が、直ちにこの団体を利用できなくなります</li>
              <li>団員（体験アカウントを除く）に削除通知メールが送信されます</li>
              <li>
                30日後に、団員・スケジュール・楽譜・会計などすべてのデータが完全に削除されます
              </li>
              <li>
                30日以内であれば、
                <Link
                  href="/contact?category=org_restore"
                  target="_blank"
                  className="text-brand-600 mx-0.5 hover:underline"
                >
                  ChoirHub運営へのお問い合わせ
                </Link>
                で復元できます
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="delete-org-confirm-name" className="mb-1 block text-xs text-gray-600">
              確認のため団体名 <span className="font-semibold text-gray-800">{orgName}</span>{" "}
              を入力してください
            </label>
            <input
              id="delete-org-confirm-name"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
          </div>
          {/* パスワードマネージャーは直前の入力欄をユーザー名とみなして自動入力するため、
              団体名欄に入らないよう専用の欄で受け止める */}
          <input
            type="text"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <div>
            <label htmlFor="delete-org-password" className="mb-1 block text-xs text-gray-600">
              パスワード
            </label>
            <input
              id="delete-org-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <Loader2 size={13} className="animate-spin" />}
            団体を削除する
          </button>
        </div>
      </form>
    </div>
  );
}
