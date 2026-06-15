"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Music, Loader2, CheckCircle } from "lucide-react";
import { authApi } from "@/lib/auth-api";
import { passwordResetRequestSchema, type PasswordResetRequestInput } from "@/lib/schemas";

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="text-sm text-gray-500 mt-1">合唱団運営支援サービス</p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-8 py-8 text-center space-y-4">
            <CheckCircle size={40} className="text-teal-500 mx-auto" />
            <p className="text-base font-semibold text-gray-800">メールを送信しました</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              パスワードリセット用のリンクをお送りしました。<br />
              受信ボックスをご確認ください。<br />
              <span className="text-xs text-gray-400">（リンクの有効期限は1時間です）</span>
            </p>
            <Link
              href="/login"
              className="block w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm text-center"
            >
              ログインページへ
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-gray-200 px-8 py-8 space-y-5">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">パスワードをお忘れですか？</p>
              <p className="text-xs text-gray-500">登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
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
              リセットメールを送信
            </button>

            <p className="text-center text-xs text-gray-400">
              <Link href="/login" className="text-blue-500 hover:underline">
                ログインページへ戻る
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
