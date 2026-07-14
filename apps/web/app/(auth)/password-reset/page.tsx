"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Music, Loader2, CheckCircle } from "lucide-react";
import { authApi } from "@/lib/auth-api";
import { passwordResetRequestSchema, type PasswordResetRequestInput } from "@/lib/schemas";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const ERROR_CLS = "text-xs text-red-500 mt-1";

export default function PasswordResetRequestPage() {
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({ resolver: zodResolver(passwordResetRequestSchema) });

  const onSubmit = async (data: PasswordResetRequestInput) => {
    try {
      await authApi.requestPasswordReset(data.email);
      setDone(true);
    } catch {
      setError("root", { message: "送信に失敗しました。しばらく後でお試しください。" });
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

        {done ? (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center">
            <CheckCircle size={40} className="mx-auto text-teal-500" />
            <p className="text-base font-semibold text-gray-800">メールを送信しました</p>
            <p className="text-sm leading-relaxed text-gray-500">
              パスワードリセット用のリンクをお送りしました。
              <br />
              受信ボックスをご確認ください。
              <br />
              <span className="text-xs text-gray-400">（リンクの有効期限は1時間です）</span>
            </p>
            <Link
              href="/login"
              className="bg-brand-600 hover:bg-brand-700 block w-full rounded-lg py-2.5 text-center text-sm font-medium text-white transition"
            >
              ログインページへ
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 rounded-2xl border border-gray-200 bg-white px-8 py-8"
          >
            <div>
              <p className="mb-1 text-sm font-semibold text-gray-800">パスワードをお忘れですか？</p>
              <p className="text-xs text-gray-500">
                登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
              </p>
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={INPUT_CLS}
                {...register("email")}
              />
              {errors.email && <p className={ERROR_CLS}>{errors.email.message}</p>}
            </div>

            {errors.root && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {errors.root.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-white transition disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              リセットメールを送信
            </button>

            <p className="text-center text-xs text-gray-400">
              <Link href="/login" className="text-brand-500 hover:underline">
                ログインページへ戻る
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
