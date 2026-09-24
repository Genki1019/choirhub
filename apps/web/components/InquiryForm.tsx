"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { inquiriesApi, INQUIRY_CATEGORY_OPTIONS, type InquiryCategory } from "@/lib/inquiries-api";
import { ApiClientError } from "@/lib/api-client";
import { inquirySchema, type InquiryInput } from "@/lib/schemas";

const INPUT_CLS =
  "focus:ring-brand-500 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none";
const ERROR_CLS = "mt-1 text-xs text-red-600";

interface InquiryFormProps {
  initialCategory?: InquiryCategory;
}

export function InquiryForm({ initialCategory = "other" }: InquiryFormProps) {
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { category: initialCategory, name: "", email: "", orgName: "", message: "" },
  });

  const onSubmit = async (data: InquiryInput) => {
    try {
      await inquiriesApi.create({ ...data, orgName: data.orgName?.trim() || undefined });
      setSuccess(true);
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiClientError && err.status === 429
            ? err.message
            : "送信に失敗しました。しばらくしてから再試行してください",
      });
    }
  };

  if (success) {
    return (
      <p className="text-sm text-gray-600">
        お問い合わせを受け付けました。内容を確認のうえ、ご入力のメールアドレスへご連絡します。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label htmlFor="inquiryCategory" className="mb-1 block text-xs font-medium text-gray-600">
          お問い合わせの種類
        </label>
        <select id="inquiryCategory" className={INPUT_CLS} {...register("category")}>
          {INQUIRY_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="inquiryName" className="mb-1 block text-xs font-medium text-gray-600">
          お名前
        </label>
        <input id="inquiryName" type="text" className={INPUT_CLS} {...register("name")} />
        {errors.name && <p className={ERROR_CLS}>{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="inquiryEmail" className="mb-1 block text-xs font-medium text-gray-600">
          メールアドレス
        </label>
        <input
          id="inquiryEmail"
          type="email"
          placeholder="you@example.com"
          className={INPUT_CLS}
          {...register("email")}
        />
        {errors.email && <p className={ERROR_CLS}>{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="inquiryOrgName" className="mb-1 block text-xs font-medium text-gray-600">
          団体名 <span className="font-normal text-gray-400">（任意）</span>
        </label>
        <input id="inquiryOrgName" type="text" className={INPUT_CLS} {...register("orgName")} />
        {errors.orgName && <p className={ERROR_CLS}>{errors.orgName.message}</p>}
      </div>
      <div>
        <label htmlFor="inquiryMessage" className="mb-1 block text-xs font-medium text-gray-600">
          お問い合わせ内容
        </label>
        <textarea
          id="inquiryMessage"
          rows={6}
          className={`${INPUT_CLS} resize-none`}
          {...register("message")}
        />
        {errors.message && <p className={ERROR_CLS}>{errors.message.message}</p>}
      </div>

      <p className="text-xs text-gray-400">
        送信内容は
        <Link href="/privacy" className="text-brand-500 mx-0.5 hover:underline">
          プライバシーポリシー
        </Link>
        に従って取り扱います。
      </p>

      {errors.root && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 size={16} className="mx-auto animate-spin" /> : "送信する"}
      </button>
    </form>
  );
}
