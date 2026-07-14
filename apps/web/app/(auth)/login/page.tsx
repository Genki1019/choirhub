"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Music, Loader2 } from "lucide-react";
import { authApi, ApiClientError } from "@/lib/auth-api";
import { loginSchema, type LoginInput } from "@/lib/schemas";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const ERROR_CLS = "text-xs text-red-500 mt-1";

export default function LoginPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    try {
      await authApi.login(data.email, data.password);
      router.push("/select-org");
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 401
          ? "メールアドレスまたはパスワードが正しくありません"
          : "ログインに失敗しました。しばらく後でお試しください。";
      setError("root", { message });
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

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white px-8 py-8"
        >
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

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={INPUT_CLS}
              {...register("password")}
            />
            {errors.password && <p className={ERROR_CLS}>{errors.password.message}</p>}
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
            ログイン
          </button>

          <p className="text-center text-xs text-gray-400">
            <Link
              href="/password-reset"
              prefetch={false}
              className="text-brand-500 hover:underline"
            >
              パスワードをお忘れですか？
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
