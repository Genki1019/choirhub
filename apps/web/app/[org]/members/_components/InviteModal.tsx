"use client";

import { useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X, Check } from "lucide-react";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import { ROLE_OPTIONS } from "@/lib/roles";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/schemas";

const INVITE_INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";
const ERROR_CLS = "text-xs text-red-500 mt-1";

interface InviteModalProps {
  org: string;
  parts: PartSummary[];
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteModal({ org, parts, onClose, onSuccess }: InviteModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { roles: ["member"] },
  });

  const onSubmit = async (data: InviteMemberInput) => {
    try {
      await membersApi.invite(org, {
        email: data.email,
        nameJa: data.nameJa || undefined,
        roles: data.roles,
        partId: data.partId || undefined,
      });
      onSuccess();
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 409
          ? "このメールアドレスはすでに団体に登録済みです"
          : "招待メールの送信に失敗しました。もう一度お試しください。";
      setError("root", { message });
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">メンバーを招待</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="invite-nameJa" className="mb-1 block text-xs font-medium text-gray-500">
              お名前
            </label>
            <input
              id="invite-nameJa"
              className={INVITE_INPUT_CLS}
              placeholder="山田 太郎"
              {...register("nameJa")}
            />
            <p className="mt-0.5 text-xs text-gray-400">
              Googleフォームの回答から入力（本人が設定画面で変更可能）
            </p>
          </div>

          <div>
            <label htmlFor="invite-email" className="mb-1 block text-xs font-medium text-gray-500">
              メールアドレス <span className="text-red-400">*</span>
            </label>
            <input
              id="invite-email"
              type="email"
              className={INVITE_INPUT_CLS}
              placeholder="member@example.com"
              {...register("email")}
            />
            {errors.email && <p className={ERROR_CLS}>{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="invite-part" className="mb-1 block text-xs font-medium text-gray-500">
              パート
            </label>
            <select
              id="invite-part"
              className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              {...register("partId")}
            >
              <option value="">未設定</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">
              ロール <span className="text-red-400">*</span>
            </label>
            <Controller
              name="roles"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="group" aria-label="ロール選択">
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={field.value.includes(value)}
                      onClick={() => {
                        const next = field.value.includes(value)
                          ? field.value.filter((r) => r !== value)
                          : [...field.value, value];
                        field.onChange(next);
                      }}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        field.value.includes(value)
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "hover:border-brand-300 border-gray-200 bg-white text-gray-500",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.roles && <p className={ERROR_CLS}>{errors.roles.message}</p>}
          </div>

          {errors.root && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              招待メールを送信
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InviteSuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <Check size={40} className="mx-auto text-teal-500" />
        <p className="text-base font-semibold text-gray-800">招待メールを送信しました</p>
        <p className="text-sm text-gray-500">
          招待先のメールアドレスに登録用リンクを送信しました。
          <br />
          リンクの有効期限は7日間です。
        </p>
        <button
          onClick={onClose}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
