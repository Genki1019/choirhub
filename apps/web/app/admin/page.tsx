"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Plus, Loader2 } from "lucide-react";
import {
  orgApplicationsApi,
  PART_TEMPLATE_LABELS,
  type OrgApplication,
} from "@/lib/org-applications-api";
import { ApiClientError } from "@/lib/auth-api";
import { orgApplicationKeys } from "@/lib/query-keys";
import { OrgApplicationForm } from "@/components/OrgApplicationForm";
import { SLUG_REGEX, sanitizeSlug } from "@/lib/slug";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const {
    data: applications = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: orgApplicationKeys.pending(),
    queryFn: orgApplicationsApi.listPending,
  });

  // 承認前のスラグ編集はサーバーの状態ではなく画面上の入力途中値なので、
  // クエリキャッシュではなくローカルステートで保持する
  const [slugEdits, setSlugEdits] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDirectCreate, setShowDirectCreate] = useState(false);

  function slugFor(a: OrgApplication): string {
    return slugEdits[a.id] ?? a.slug;
  }

  function handleSlugChange(id: string, slug: string) {
    setSlugEdits((prev) => ({ ...prev, [id]: slug }));
  }

  function removeFromList(id: string) {
    queryClient.setQueryData<OrgApplication[]>(orgApplicationKeys.pending(), (prev) =>
      prev?.filter((a) => a.id !== id),
    );
    setSlugEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)));
  }

  async function handleApprove(id: string, slug: string) {
    setProcessing(id);
    setActionError(null);
    try {
      await orgApplicationsApi.approve(id, slug);
      removeFromList(id);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setActionError("このスラグはすでに使用されています");
      } else if (err instanceof ApiClientError && err.status === 400) {
        setActionError("スラグの形式が正しくありません（英小文字・数字・ハイフン、2〜50文字）");
      } else {
        setActionError("操作に失敗しました。もう一度お試しください。");
      }
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    setProcessing(id);
    setActionError(null);
    try {
      await orgApplicationsApi.reject(id);
      removeFromList(id);
    } catch {
      setActionError("操作に失敗しました。もう一度お試しください。");
    } finally {
      setProcessing(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {showDirectCreate ? (
        <div className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">団体を作成する</p>
            <button
              type="button"
              onClick={() => setShowDirectCreate(false)}
              aria-label="作成フォームを閉じる"
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <OrgApplicationForm
            submitFn={orgApplicationsApi.createDirect}
            successMessage="団体を作成し、招待メールを送信しました。"
            submitLabel="作成する"
          />
        </div>
      ) : (
        <button
          onClick={() => setShowDirectCreate(true)}
          className="hover:text-brand-600 hover:border-brand-300 mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-colors hover:bg-white"
        >
          <Plus size={16} />
          団体を作成する
        </button>
      )}

      <h1 className="mb-4 text-lg font-semibold text-gray-800">団体作成の申請</h1>

      {isError && (
        <p className="mb-4 text-sm text-red-600">
          申請一覧の取得に失敗しました。しばらくしてから再度お試しください。
        </p>
      )}
      {actionError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {actionError}
        </p>
      )}

      {!isError && applications.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">保留中の申請はありません</p>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{a.orgName}</p>
                <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                  <p>パート構成: {PART_TEMPLATE_LABELS[a.templateKey]}</p>
                  <p>
                    申請者: {a.applicantName}（{a.applicantEmail}）
                  </p>
                  {a.message && <p>メッセージ: {a.message}</p>}
                </div>
                <div className="mt-2">
                  <label
                    htmlFor={`slug-${a.id}`}
                    className="mb-1 block text-xs font-medium text-gray-600"
                  >
                    スラグ
                  </label>
                  <div className="focus-within:ring-brand-500 flex max-w-xs items-center gap-1 overflow-hidden rounded-lg border border-gray-200 text-xs focus-within:ring-2">
                    <span className="px-2 text-gray-400 select-none">choirhub.app/</span>
                    <input
                      id={`slug-${a.id}`}
                      type="text"
                      value={slugFor(a)}
                      onChange={(e) => handleSlugChange(a.id, sanitizeSlug(e.target.value))}
                      minLength={2}
                      maxLength={50}
                      pattern="[a-z0-9-]+"
                      className="flex-1 py-1.5 pr-2 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleApprove(a.id, slugFor(a))}
                  disabled={processing !== null || !SLUG_REGEX.test(slugFor(a))}
                  aria-label="承認"
                  className="flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
                >
                  {processing === a.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  承認
                </button>
                <button
                  onClick={() => handleReject(a.id)}
                  disabled={processing !== null}
                  aria-label="却下"
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  <X size={13} />
                  却下
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
