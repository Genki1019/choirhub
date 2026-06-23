"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Music, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { authApi, ApiClientError } from "@/lib/auth-api";
import { passwordResetConfirmSchema, type PasswordResetConfirmInput } from "@/lib/schemas";

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const ERROR_CLS = "text-xs text-red-500 mt-1";

export default function PasswordResetConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [email,      setEmail]      = useState<string | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [showPass,   setShowPass]   = useState(false);
  const [done,       setDone]       = useState(false);

  useEffect(() => {
    authApi.getPasswordResetToken(token)
      .then((data) => setEmail(data.email))
      .catch(() => setLoadError("リンクが無効または期限切れです。もう一度パスワードリセットを申請してください。"));
  }, [token]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetConfirmInput>({ resolver: zodResolver(passwordResetConfirmSchema) });

  const onSubmit = async (data: PasswordResetConfirmInput) => {
    try {
      await authApi.confirmPasswordReset(token, data.password);
      setDone(true);
    } catch (err) {
      const message = err instanceof ApiClientError && err.status === 404
        ? "リンクが無効または期限切れです。もう一度申請してください。"
        : "パスワードの変更に失敗しました。しばらく後でお試しください。";
      setError("root", { message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="text-sm text-gray-500 mt-1">合唱団運営支援サービス</p>
        </div>

        {loadError && (
          <div className="bg-white rounded-2xl border border-gray-200 px-8 py-8 text-center space-y-4">
            <p className="text-sm text-red-600">{loadError}</p>
            <Link
              href="/password-reset"
              className="block w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm text-center"
            >
              再申請する
            </Link>
          </div>
        )}

        {!loadError && !email && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {email && done && (
          <div className="bg-white rounded-2xl border border-gray-200 px-8 py-8 text-center space-y-4">
            <CheckCircle size={40} className="text-teal-500 mx-auto" />
            <p className="text-base font-semibold text-gray-800">パスワードを変更しました</p>
            <p className="text-sm text-gray-500">新しいパスワードでログインしてください。</p>
            <button
              onClick={() => router.push("/login")}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              ログインページへ
            </button>
          </div>
        )}

        {email && !done && (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-gray-200 px-8 py-8 space-y-5">
            <div>
              <p className="text-sm font-semibold text-gray-800">新しいパスワードを設定</p>
              <p className="text-xs text-gray-500 mt-0.5">{email}</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                新しいパスワード <span className="text-xs text-gray-400 font-normal">（8文字以上）</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className={INPUT_CLS}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "パスワードを隠す" : "パスワードを表示する"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className={ERROR_CLS}>{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                パスワード（確認）
              </label>
              <input
                id="passwordConfirm"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                className={INPUT_CLS}
                {...register("passwordConfirm")}
              />
              {errors.passwordConfirm && <p className={ERROR_CLS}>{errors.passwordConfirm.message}</p>}
            </div>

            {errors.root && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errors.root.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              パスワードを変更する
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
