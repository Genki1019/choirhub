"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  orgApplicationsApi,
  PART_TEMPLATE_OPTIONS,
  type OrgCreateFields,
} from "@/lib/org-applications-api";
import { ApiClientError } from "@/lib/auth-api";
import { orgApplicationSchema, type OrgApplicationInput } from "@/lib/schemas";
import { sanitizeSlug } from "@/lib/slug";

const INPUT_CLS =
  "focus:ring-brand-500 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none";
const ERROR_CLS = "mt-1 text-xs text-red-600";

function toSlug(name: string): string {
  return sanitizeSlug(name.replace(/[\s_]+/g, "-"))
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

interface OrgApplicationFormProps {
  initialName?: string;
  initialEmail?: string;
  submitFn?: (data: OrgCreateFields) => Promise<{ message: string }>;
  successMessage?: string;
  submitLabel?: string;
}

export function OrgApplicationForm({
  initialName = "",
  initialEmail = "",
  submitFn = orgApplicationsApi.create,
  successMessage = "送信しました。システム管理者の承認をお待ちください。",
  submitLabel = "申請する",
}: OrgApplicationFormProps) {
  const [success, setSuccess] = useState(false);
  const slugManual = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrgApplicationInput>({
    resolver: zodResolver(orgApplicationSchema),
    defaultValues: {
      orgName: "",
      slug: "",
      templateKey: PART_TEMPLATE_OPTIONS[0].key,
      applicantName: initialName,
      applicantEmail: initialEmail,
      message: "",
    },
  });

  const orgName = useWatch({ control, name: "orgName" });
  useEffect(() => {
    if (!slugManual.current) {
      setValue("slug", toSlug(orgName), { shouldValidate: true });
    }
  }, [orgName, setValue]);

  const onSubmit = async (data: OrgApplicationInput) => {
    try {
      await submitFn({ ...data, message: data.message?.trim() || undefined });
      setSuccess(true);
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiClientError && err.status === 409
            ? "このスラグはすでに使用されています"
            : "送信に失敗しました。しばらくしてから再試行してください",
      });
    }
  };

  if (success) {
    return <p className="text-sm text-gray-600">{successMessage}</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label htmlFor="applyOrgName" className="mb-1 block text-xs font-medium text-gray-600">
          団体名
        </label>
        <input
          id="applyOrgName"
          type="text"
          placeholder="○○合唱団"
          className={INPUT_CLS}
          {...register("orgName")}
        />
        {errors.orgName && <p className={ERROR_CLS}>{errors.orgName.message}</p>}
      </div>
      <div>
        <label htmlFor="applyOrgSlug" className="mb-1 block text-xs font-medium text-gray-600">
          スラグ <span className="font-normal text-gray-400">（URL に使用）</span>
        </label>
        <div className="focus-within:ring-brand-500 flex items-center gap-1 overflow-hidden rounded-lg border border-gray-200 text-sm focus-within:ring-2">
          <span className="px-2 text-gray-400 select-none">choirhub.app/</span>
          <input
            id="applyOrgSlug"
            type="text"
            placeholder="my-choir"
            className="flex-1 py-2 pr-3 focus:outline-none"
            {...register("slug")}
            onChange={(e) => {
              slugManual.current = true;
              setValue("slug", sanitizeSlug(e.target.value), { shouldValidate: true });
            }}
          />
        </div>
        {errors.slug && <p className={ERROR_CLS}>{errors.slug.message}</p>}
      </div>
      <div>
        <label htmlFor="applyTemplateKey" className="mb-1 block text-xs font-medium text-gray-600">
          パート構成
        </label>
        <select id="applyTemplateKey" className={INPUT_CLS} {...register("templateKey")}>
          {PART_TEMPLATE_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="applyName" className="mb-1 block text-xs font-medium text-gray-600">
          管理者氏名
        </label>
        <input
          id="applyName"
          type="text"
          placeholder="山田 太郎"
          className={INPUT_CLS}
          {...register("applicantName")}
        />
        {errors.applicantName && <p className={ERROR_CLS}>{errors.applicantName.message}</p>}
      </div>
      <div>
        <label htmlFor="applyEmail" className="mb-1 block text-xs font-medium text-gray-600">
          管理者メールアドレス
        </label>
        <input
          id="applyEmail"
          type="email"
          placeholder="you@example.com"
          className={INPUT_CLS}
          {...register("applicantEmail")}
        />
        {errors.applicantEmail && <p className={ERROR_CLS}>{errors.applicantEmail.message}</p>}
      </div>
      <div>
        <label htmlFor="applyMessage" className="mb-1 block text-xs font-medium text-gray-600">
          メッセージ <span className="font-normal text-gray-400">（任意）</span>
        </label>
        <textarea
          id="applyMessage"
          placeholder="団体の形態や規模など、参考になる情報があればご記入ください"
          rows={3}
          className={`${INPUT_CLS} resize-none`}
          {...register("message")}
        />
      </div>

      {errors.root && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 size={16} className="mx-auto animate-spin" /> : submitLabel}
      </button>
    </form>
  );
}
