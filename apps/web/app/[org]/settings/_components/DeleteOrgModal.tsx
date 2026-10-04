"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { settingsApi } from "@/lib/settings-api";
import { userErrorMessage } from "@/lib/api-client";

interface DeleteOrgModalProps {
  orgSlug: string;
  orgName: string;
  onClose: () => void;
}

export function DeleteOrgModal({ orgSlug, orgName, onClose }: DeleteOrgModalProps) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmName === orgName && password.length > 0 && !deleting;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setDeleting(true);
    setError(null);
    try {
      await settingsApi.deleteOrg(orgSlug, { confirmName, password });
      router.replace("/select-org");
    } catch (err) {
      setError(userErrorMessage(err, "削除に失敗しました。もう一度お試しください。"));
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="団体を削除しますか？"
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={deleting}
      footer={
        <>
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
        </>
      }
    >
      <ul className="list-disc space-y-1 pl-4 text-sm text-gray-500">
        <li>すべての団員が、直ちにこの団体を利用できなくなります</li>
        <li>団員（体験アカウントを除く）に削除通知メールが送信されます</li>
        <li>30日後に、団員・スケジュール・楽譜・会計などすべてのデータが完全に削除されます</li>
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

      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}
