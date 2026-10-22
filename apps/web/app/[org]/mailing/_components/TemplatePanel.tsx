"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mailingApi, type MailTemplate } from "@/lib/mailing-api";
import { mailingKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { userErrorMessage } from "@/lib/api-client";

interface TemplatePanelProps {
  orgSlug: string;
  onApply: (t: MailTemplate) => void;
  onClose: () => void;
}

export function TemplatePanel({ orgSlug, onApply, onClose }: TemplatePanelProps) {
  const queryClient = useQueryClient();
  const { memberId, roles } = useMember();
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MailTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    data: templates = [],
    isLoading: loading,
    error: loadError,
  } = useQuery({
    queryKey: mailingKeys.templates(orgSlug),
    queryFn: () => mailingApi.templates.list(orgSlug),
  });

  const canDelete = (t: MailTemplate) => roles.includes("admin") || t.createdBy.id === memberId;

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await mailingApi.templates.delete(orgSlug, id);
      await queryClient.invalidateQueries({ queryKey: mailingKeys.templates(orgSlug) });
      setConfirmTarget(null);
    } catch (err) {
      setDeleteError(
        userErrorMessage(err, "テンプレートの削除に失敗しました。もう一度お試しください。"),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <span className="text-xs font-medium text-gray-600">テンプレート</span>
        <button
          type="button"
          aria-label="テンプレートパネルを閉じる"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-44 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-gray-400">
            <Loader2 size={13} className="animate-spin" />
            <span className="text-xs">読み込み中...</span>
          </div>
        )}
        {loadError && (
          <ErrorMessage autoScroll={false} className="m-3">
            {userErrorMessage(
              loadError,
              "テンプレートの読み込みに失敗しました。もう一度お試しください。",
            )}
          </ErrorMessage>
        )}
        {!loading && !loadError && templates.length === 0 && (
          <p className="px-4 py-3 text-xs text-gray-400">保存済みテンプレートがありません</p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="border-b border-gray-100 last:border-0">
            <div className="group flex items-center justify-between px-4 py-2.5 hover:bg-white">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  onApply(t);
                  onClose();
                }}
              >
                <p className="truncate text-sm font-medium text-gray-700">{t.name}</p>
                <p className="truncate text-xs text-gray-400">{t.subject}</p>
              </button>
              {canDelete(t) && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmTarget(t);
                  }}
                  className="ml-2 shrink-0 text-gray-300 transition-colors hover:text-red-500"
                  aria-label={`テンプレート「${t.name}」を削除`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmTarget && (
        <ConfirmDialog
          title="テンプレートを削除しますか？"
          description={`「${confirmTarget.name}」を削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deleting}
          error={deleteError}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => handleDelete(confirmTarget.id)}
        />
      )}
    </div>
  );
}
