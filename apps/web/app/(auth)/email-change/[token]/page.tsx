"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Music, Loader2, CheckCircle } from "lucide-react";
import { authApi, ApiClientError } from "@/lib/auth-api";

export default function EmailChangeConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    authApi
      .getEmailChangeToken(token)
      .then((data) => setNewEmail(data.newEmail))
      .catch(() =>
        setLoadError(
          "リンクが無効または期限切れです。もう一度メールアドレス変更を申請してください。",
        ),
      );
  }, [token]);

  const handleConfirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      await authApi.confirmEmailChange(token);
      setDone(true);
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 409
          ? "このメールアドレスは既に使用されています。"
          : err instanceof ApiClientError && err.status === 404
            ? "リンクが無効または期限切れです。もう一度申請してください。"
            : "メールアドレスの変更に失敗しました。しばらく後でお試しください。";
      setConfirmError(message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="bg-brand-600 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="mt-1 text-sm text-gray-500">合唱団運営支援サービス</p>
        </div>

        {loadError && (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
          </div>
        )}

        {!loadError && !newEmail && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {newEmail && done && (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center">
            <CheckCircle size={40} className="mx-auto text-teal-500" />
            <p className="text-base font-semibold text-gray-800">メールアドレスを変更しました</p>
            <p className="text-sm text-gray-500">
              安全のため既存のログインは無効化されました。新しいメールアドレスで再度ログインしてください。
            </p>
            <button
              onClick={() => router.push("/login")}
              className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition"
            >
              ログインページへ
            </button>
          </div>
        )}

        {newEmail && !done && (
          <div className="space-y-5 rounded-2xl border border-gray-200 bg-white px-8 py-8">
            <div>
              <p className="text-sm font-semibold text-gray-800">メールアドレス変更の確認</p>
              <p className="mt-0.5 text-xs text-gray-500">
                このアカウントのログイン用メールアドレスを次のアドレスに変更します。
              </p>
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {newEmail}
              </p>
            </div>

            {confirmError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {confirmError}
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-white transition disabled:opacity-60"
            >
              {confirming && <Loader2 size={16} className="animate-spin" />}
              このメールアドレスに変更する
            </button>
            <Link href="/" className="block text-center text-xs text-gray-400 hover:text-gray-600">
              キャンセルする
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
