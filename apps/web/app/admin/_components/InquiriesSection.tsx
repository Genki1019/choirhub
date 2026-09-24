"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { AdminListSection } from "./AdminListSection";
import { inquiriesApi, INQUIRY_CATEGORY_LABELS, type Inquiry } from "@/lib/inquiries-api";
import { inquiryKeys } from "@/lib/query-keys";

export function InquiriesSection() {
  const queryClient = useQueryClient();
  const {
    data: inquiries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: inquiryKeys.open(),
    queryFn: inquiriesApi.listOpen,
  });
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleResolve(inquiry: Inquiry) {
    setResolvingId(inquiry.id);
    setActionError(null);
    try {
      await inquiriesApi.resolve(inquiry.id);
      queryClient.setQueryData<Inquiry[]>(inquiryKeys.open(), (prev) =>
        prev?.filter((i) => i.id !== inquiry.id),
      );
    } catch {
      setActionError("更新に失敗しました。もう一度お試しください。");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <AdminListSection
      title="未対応のお問い合わせ"
      isLoading={isLoading}
      isError={isError}
      loadErrorMessage="お問い合わせの取得に失敗しました。しばらくしてから再度お試しください。"
      actionError={actionError}
      isEmpty={inquiries.length === 0}
      emptyMessage="未対応のお問い合わせはありません"
    >
      {inquiries.map((inquiry) => (
        <div
          key={inquiry.id}
          className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">
              {INQUIRY_CATEGORY_LABELS[inquiry.category]}・
              {new Date(inquiry.createdAt).toLocaleDateString("ja-JP")}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {inquiry.name}（{inquiry.email}）
            </p>
            {inquiry.orgName && <p className="text-xs text-gray-500">団体名: {inquiry.orgName}</p>}
            <p className="mt-2 text-sm whitespace-pre-wrap text-gray-700">{inquiry.message}</p>
          </div>
          <button
            type="button"
            onClick={() => handleResolve(inquiry)}
            disabled={resolvingId !== null}
            aria-label={`${inquiry.name}さんのお問い合わせを対応済みにする`}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {resolvingId === inquiry.id ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            対応済み
          </button>
        </div>
      ))}
    </AdminListSection>
  );
}
