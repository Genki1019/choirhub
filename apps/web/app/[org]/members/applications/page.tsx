"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import { useMember } from "@/contexts/MemberContext";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import { visitorApplicationKeys } from "@/lib/query-keys";
import type { VisitorApplication, VisitorApplicationDraft } from "@/lib/api-types";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ComposeModal } from "../../mailing/_components/ComposeModal";
import { ApprovalDraftBanner } from "./_components/ApprovalDraftBanner";
import { ApplicationRow } from "./_components/ApplicationRow";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const ERROR_MESSAGE = "操作に失敗しました。もう一度お試しください。";

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
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<VisitorApplication | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const { copiedKey, copy, reset: resetCopied } = useClipboardCopy();

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
    setError(null);
    try {
      const result = await visitorApplicationsApi.approve(org, id);
      removeFromList([id]);
      setDraft(result.draft);
      resetCopied();
    } catch {
      setError(ERROR_MESSAGE);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    setRejectError(null);
    try {
      await visitorApplicationsApi.reject(org, id);
      removeFromList([id]);
      setConfirmReject(null);
    } catch {
      setRejectError(ERROR_MESSAGE);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setProcessing("bulk");
    setError(null);
    try {
      const result = await visitorApplicationsApi.bulkApprove(org, ids);
      removeFromList(ids);
      setDraft(result.draft);
      resetCopied();
    } catch {
      setError(ERROR_MESSAGE);
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
            type="button"
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
        <ApprovalDraftBanner
          copied={copiedKey === "draft"}
          onCompose={() => setShowCompose(true)}
          onCopy={() => copy(draft.body, "draft")}
          onClose={() => setDraft(null)}
        />
      )}

      <ErrorMessage className="mb-4">{error}</ErrorMessage>

      {applications.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">保留中の見学申込はありません</p>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <ApplicationRow
              key={a.id}
              application={a}
              selected={selectedIds.has(a.id)}
              processing={processing === a.id}
              disabled={processing !== null}
              onToggleSelect={toggleSelect}
              onApprove={handleApprove}
              onReject={(id) => {
                setError(null);
                setRejectError(null);
                setConfirmReject(applications.find((app) => app.id === id) ?? null);
              }}
            />
          ))}
        </div>
      )}

      {confirmReject && (
        <ConfirmDialog
          title="見学申込を却下しますか？"
          description={`${confirmReject.name}さんの申込を却下します。却下した申込は元に戻せません。`}
          confirmLabel="却下する"
          busy={processing === confirmReject.id}
          error={rejectError}
          onCancel={() => setConfirmReject(null)}
          onConfirm={() => handleReject(confirmReject.id)}
        />
      )}

      {showCompose && draft && (
        <ComposeModal
          orgSlug={org}
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
