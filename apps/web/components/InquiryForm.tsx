"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { inquiriesApi, INQUIRY_CATEGORY_OPTIONS, type InquiryCategory } from "@/lib/inquiries-api";
import { ApiClientError } from "@/lib/api-client";
import { inquirySchema, type InquiryInput } from "@/lib/schemas";
import { ErrorMessage } from "@/components/ErrorMessage";
import { FieldError, fieldErrorProps } from "@/components/FieldError";
import { useFocusFirstFieldError } from "@/hooks/useFocusFirstFieldError";

const INPUT_CLS =
  "focus:ring-brand-500 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none";

interface InquiryFormProps {
  initialCategory?: InquiryCategory;
}

export function InquiryForm({ initialCategory = "other" }: InquiryFormProps) {
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { category: initialCategory, name: "", email: "", orgName: "", message: "" },
    shouldFocusError: false,
  });
  useFocusFirstFieldError(errors, submitCount, setFocus);

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
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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
        <input
          id="inquiryName"
          type="text"
          className={INPUT_CLS}
          {...register("name")}
          {...fieldErrorProps("inquiryName-error", errors.name?.message)}
        />
        <FieldError id="inquiryName-error">{errors.name?.message}</FieldError>
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
          {...fieldErrorProps("inquiryEmail-error", errors.email?.message)}
        />
        <FieldError id="inquiryEmail-error">{errors.email?.message}</FieldError>
      </div>
      <div>
        <label htmlFor="inquiryOrgName" className="mb-1 block text-xs font-medium text-gray-600">
          団体名 <span className="font-normal text-gray-400">（任意）</span>
        </label>
        <input
          id="inquiryOrgName"
          type="text"
          className={INPUT_CLS}
          {...register("orgName")}
          {...fieldErrorProps("inquiryOrgName-error", errors.orgName?.message)}
        />
        <FieldError id="inquiryOrgName-error">{errors.orgName?.message}</FieldError>
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
          {...fieldErrorProps("inquiryMessage-error", errors.message?.message)}
        />
        <FieldError id="inquiryMessage-error">{errors.message?.message}</FieldError>
      </div>

      <p className="text-xs text-gray-400">
        送信内容は
        <Link href="/privacy" className="text-brand-500 mx-0.5 hover:underline">
          プライバシーポリシー
        </Link>
        に従って取り扱います。
      </p>

      <ErrorMessage>{errors.root?.message}</ErrorMessage>

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
