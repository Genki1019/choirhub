"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { authApi, type InviteInfo, ApiClientError } from "@/lib/auth-api";
import {
  inviteAcceptSchema,
  type InviteAcceptInput,
  inviteAcceptExistingUserSchema,
  type InviteAcceptExistingUserInput,
} from "@/lib/schemas";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const ERROR_CLS = "text-xs text-red-500 mt-1";

const ALREADY_REGISTERED_MESSAGE =
  "このメールアドレスはすでに登録済みです。ログインページからログインしてください。";
const GENERIC_FAILURE_MESSAGE = "登録に失敗しました。もう一度お試しください。";

// 招待受諾の送信失敗時のメッセージを判定する。401（パスワード不一致）はバックエンドの
// 既存ユーザー確認フローでしか発生しないため、新規/既存どちらのフォーム経由でも案内してよい。
function inviteAcceptErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError && err.status === 409) return ALREADY_REGISTERED_MESSAGE;
  if (err instanceof ApiClientError && err.status === 401) return "パスワードが正しくありません";
  return GENERIC_FAILURE_MESSAGE;
}

function PasswordField({
  id,
  label,
  registration,
  error,
  showPassword,
  onToggleShow,
}: {
  id: string;
  label: React.ReactNode;
  registration: UseFormRegisterReturn;
  error?: string;
  showPassword: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          className={INPUT_CLS}
          {...registration}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className={ERROR_CLS}>{error}</p>}
    </div>
  );
}

function InviteFormShell({
  onSubmit,
  rootError,
  isSubmitting,
  submitLabel,
  children,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  rootError?: string;
  isSubmitting: boolean;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white px-8 py-8"
    >
      {children}

      {rootError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {rootError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-white transition disabled:opacity-60"
      >
        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}

interface InviteFormProps {
  token: string;
  invite: InviteInfo;
}

export function InviteForm({ token, invite }: InviteFormProps) {
  const router = useRouter();
  const [done, setDone] = useState(false);

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

  return invite.isExistingUser ? (
    <ExistingUserForm token={token} invite={invite} />
  ) : (
    <NewUserForm token={token} invite={invite} onDone={() => setDone(true)} />
  );
}

function NewUserForm({
  token,
  invite,
  onDone,
}: {
  token: string;
  invite: InviteInfo;
  onDone: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

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
      onDone();
    } catch (err) {
      setError("root", { message: inviteAcceptErrorMessage(err) });
    }
  };

  return (
    <InviteFormShell
      onSubmit={handleSubmit(onSubmit)}
      rootError={errors.root?.message}
      isSubmitting={isSubmitting}
      submitLabel="登録する"
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

      <PasswordField
        id="password"
        label={
          <>
            パスワード <span className="text-xs font-normal text-gray-400">（8文字以上）</span>
          </>
        }
        registration={register("password")}
        error={errors.password?.message}
        showPassword={showPassword}
        onToggleShow={() => setShowPassword((v) => !v)}
      />

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
    </InviteFormShell>
  );
}

function ExistingUserForm({ token, invite }: { token: string; invite: InviteInfo }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteAcceptExistingUserInput>({
    resolver: zodResolver(inviteAcceptExistingUserSchema),
  });

  const onSubmit = async (data: InviteAcceptExistingUserInput) => {
    try {
      const result = await authApi.acceptInvite(token, { password: data.password });
      router.push(result.orgSlug ? `/${result.orgSlug}` : `/${invite.orgSlug}`);
    } catch (err) {
      setError("root", { message: inviteAcceptErrorMessage(err) });
    }
  };

  return (
    <InviteFormShell
      onSubmit={handleSubmit(onSubmit)}
      rootError={errors.root?.message}
      isSubmitting={isSubmitting}
      submitLabel="ログインして参加する"
    >
      <div>
        <p className="text-sm font-semibold text-gray-800">{invite.orgName} への参加</p>
        <p className="mt-1 text-xs text-gray-500">
          {invite.email} のアカウントに追加されます。現在お使いのパスワードを入力してください。
        </p>
      </div>

      <PasswordField
        id="password"
        label="パスワード"
        registration={register("password")}
        error={errors.password?.message}
        showPassword={showPassword}
        onToggleShow={() => setShowPassword((v) => !v)}
      />
    </InviteFormShell>
  );
}
