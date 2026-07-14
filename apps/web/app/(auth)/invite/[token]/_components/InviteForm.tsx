"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { authApi, type InviteInfo, ApiClientError } from "@/lib/auth-api";
import { inviteAcceptSchema, type InviteAcceptInput } from "@/lib/schemas";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const ERROR_CLS = "text-xs text-red-500 mt-1";

interface InviteFormProps {
  token: string;
  invite: InviteInfo;
}

export function InviteForm({ token, invite }: InviteFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteAcceptInput>({
    resolver: zodResolver(inviteAcceptSchema),
    defaultValues: { nameJa: invite.nameJa ?? "" },
  });

  const onSubmit = async (data: InviteAcceptInput) => {
    try {
      await authApi.acceptInvite(token, { nameJa: data.nameJa, password: data.password });
      setDone(true);
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 409
          ? "このメールアドレスはすでに登録済みです。ログインページからログインしてください。"
          : "登録に失敗しました。もう一度お試しください。";
      setError("root", { message });
    }
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center">
        <CheckCircle size={40} className="mx-auto text-teal-500" />
        <p className="text-base font-semibold text-gray-800">登録が完了しました</p>
        <p className="text-sm text-gray-500">
          {invite.orgName} へようこそ！
          <br />
          ログインページからサインインしてください。
        </p>
        <button
          onClick={() => router.push("/login")}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition"
        >
          ログインページへ
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white px-8 py-8"
    >
      <div>
        <p className="text-sm font-semibold text-gray-800">{invite.orgName} への参加登録</p>
        <p className="mt-0.5 text-xs text-gray-500">{invite.email}</p>
      </div>

      <div>
        <label htmlFor="nameJa" className="mb-1.5 block text-sm font-medium text-gray-700">
          お名前
        </label>
        <input
          id="nameJa"
          type="text"
          placeholder="山田 太郎"
          className={INPUT_CLS}
          {...register("nameJa")}
        />
        {errors.nameJa && <p className={ERROR_CLS}>{errors.nameJa.message}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
          パスワード <span className="text-xs font-normal text-gray-400">（8文字以上）</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className={INPUT_CLS}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && <p className={ERROR_CLS}>{errors.password.message}</p>}
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="mb-1.5 block text-sm font-medium text-gray-700">
          パスワード（確認）
        </label>
        <input
          id="passwordConfirm"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          className={INPUT_CLS}
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && <p className={ERROR_CLS}>{errors.passwordConfirm.message}</p>}
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
        登録する
      </button>
    </form>
  );
}
