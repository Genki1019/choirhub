"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, Copy, Mail } from "lucide-react";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { memberKeys, visitorApplicationKeys } from "@/lib/query-keys";
import type { VisitorApplication, VisitorApplicationDraft } from "@/lib/api-types";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ComposeModal } from "../../mailing/_components/ComposeModal";

// 「テキストをコピーする」だけで紹介メールをまだ送っていない下書きを、
// 画面遷移で見失わないようセッション中は保持しておく
function draftStorageKey(org: string): string {
  return `visitorApplicationDraft:${org}`;
}

function loadStoredDraft(org: string): VisitorApplicationDraft | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(draftStorageKey(org));
  if (!stored) return null;
  try {
    return JSON.parse(stored) as VisitorApplicationDraft;
  } catch {
    return null;
  }
}

export default function VisitorApplicationsPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const { roles } = useMember();
  const queryClient = useQueryClient();
  const isAdmin = roles.includes("admin");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const [draft, setDraft] = useState<VisitorApplicationDraft | null>(() => loadStoredDraft(org));
  const [showCompose, setShowCompose] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const key = draftStorageKey(org);
    if (draft) {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } else {
      sessionStorage.removeItem(key);
    }
  }, [draft, org]);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: visitorApplicationKeys.pending(org),
    queryFn: () => visitorApplicationsApi.listPending(org),
    enabled: isAdmin,
  });

  const { data: parts = [] } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!isAdmin) router.replace(`/${org}/members`);
  }, [isAdmin, org, router]);

  if (!isAdmin) return null;

  const removeFromList = (ids: string[]) => {
    queryClient.setQueryData<VisitorApplication[]>(visitorApplicationKeys.pending(org), (prev) =>
      prev ? prev.filter((a) => !ids.includes(a.id)) : prev,
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const result = await visitorApplicationsApi.approve(org, id);
      removeFromList([id]);
      setDraft(result.draft);
      setCopied(false);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      await visitorApplicationsApi.reject(org, id);
      removeFromList([id]);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setProcessing("bulk");
    try {
      const result = await visitorApplicationsApi.bulkApprove(org, ids);
      removeFromList(ids);
      setDraft(result.draft);
      setCopied(false);
    } finally {
      setProcessing(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageWithHeader
      title="見学申込"
      backHref={`/${org}/members`}
      loading={isLoading}
      actions={
        selectedIds.size > 0 ? (
          <button
            onClick={handleBulkApprove}
            disabled={processing !== null}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {processing === "bulk" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            選択した{selectedIds.size}件を一括承認
          </button>
        ) : undefined
      }
    >
      {draft && (
        <div className="mb-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-teal-700">承認しました。団員へ共有しますか？</p>
            <button
              onClick={() => setDraft(null)}
              aria-label="閉じる"
              className="shrink-0 text-teal-500 transition-colors hover:text-teal-700"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-teal-600">
            画面を移動してもこの案内は消えません。団員へ共有し終えたら「閉じる」を押してください。
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCompose(true)}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              <Mail size={14} />
              今すぐ紹介メールを送る
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(draft.body);
                setCopied(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Copy size={14} />
              {copied ? "コピーしました" : "テキストをコピーする"}
            </button>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">保留中の見学申込はありません</p>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(a.id)}
                onChange={() => toggleSelect(a.id)}
                className="accent-brand-600 mt-1 h-4 w-4 rounded"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                    {a.source === "google_form" ? "Googleフォーム" : "手入力"}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                  {a.partHope && <p>希望パート: {a.partHope}</p>}
                  {a.originGroup && <p>出身団体: {a.originGroup}</p>}
                  {a.contact && <p>連絡先: {a.contact}</p>}
                  {a.message && <p>コメント: {a.message}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleApprove(a.id)}
                  disabled={processing !== null}
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

      {showCompose && draft && (
        <ComposeModal
          orgSlug={org}
          parts={parts}
          initialSubject={draft.subject}
          initialBody={draft.body}
          initialRecipientType="all"
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            setDraft(null);
          }}
        />
      )}
    </PageWithHeader>
  );
}
