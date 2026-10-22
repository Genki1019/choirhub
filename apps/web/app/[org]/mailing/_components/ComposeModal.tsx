"use client";

import { useState, useEffect, type FormEvent } from "react";
import { X, Loader2, Send, BookMarked, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  mailingApi,
  type RecipientType,
  type MailTemplate,
  type SendMailInput,
} from "@/lib/mailing-api";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { memberKeys } from "@/lib/query-keys";
import { ROLES } from "@/lib/roles";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { userErrorMessage } from "@/lib/api-client";

const RECIPIENT_TABS: { key: RecipientType; label: string }[] = [
  { key: "all", label: "全員" },
  { key: "part", label: "パート" },
  { key: "role", label: "ロール" },
  { key: "custom", label: "個別" },
];

const TEMPLATE_NAME_MAX = 100;

interface SaveTemplateModalProps {
  orgSlug: string;
  subject: string;
  body: string;
  onClose: () => void;
  onSaved: (t: MailTemplate) => void;
}

function SaveTemplateModal({ orgSlug, subject, body, onClose, onSaved }: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("テンプレート名を入力してください");
      return;
    }
    if (!subject.trim()) {
      setError("件名が空です");
      return;
    }
    if (!body.trim()) {
      setError("本文が空です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const template = await mailingApi.templates.save(orgSlug, {
        name: name.trim(),
        subject,
        body,
      });
      onSaved(template);
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, "テンプレートの保存に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="テンプレートとして保存"
      size="sm"
      onClose={onClose}
      onSubmit={handleSave}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}保存
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="template-name" className="mb-1.5 block text-xs font-medium text-gray-600">
          テンプレート名 <span className="text-red-500">*</span>
        </label>
        <input
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TEMPLATE_NAME_MAX}
          placeholder="例: 練習案内テンプレート"
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          autoFocus
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </Modal>
  );
}

interface TemplatePanelProps {
  orgSlug: string;
  onApply: (t: MailTemplate) => void;
  onClose: () => void;
}

function TemplatePanel({ orgSlug, onApply, onClose }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MailTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    mailingApi.templates
      .list(orgSlug)
      .then((templates) => setTemplates(templates))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgSlug]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await mailingApi.templates.delete(orgSlug, id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
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
        {!loading && templates.length === 0 && (
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

const optionClass =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50";

export interface ComposeModalProps {
  orgSlug: string;
  onClose: () => void;
  onSent: () => void;
  initialSubject?: string;
  initialBody?: string;
  initialRecipientType?: RecipientType;
}

export function ComposeModal({
  orgSlug,
  onClose,
  onSent,
  initialSubject = "",
  initialBody = "",
  initialRecipientType = "all",
}: ComposeModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [recipientType, setRecipientType] = useState<RecipientType>(initialRecipientType);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const [pendingSend, setPendingSend] = useState<{
    count: number;
    recipients: Pick<SendMailInput, "recipientType" | "recipientFilter">;
  } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const {
    data: parts = [],
    isLoading: loadingParts,
    error: partsError,
  } = useQuery({
    queryKey: memberKeys.parts(orgSlug),
    queryFn: () => membersApi.parts(orgSlug),
  });

  const handleRecipientTypeChange = (type: RecipientType) => {
    setRecipientType(type);
    setError(null);
    if (type === "custom" && members.length === 0) {
      setLoadingMembers(true);
      membersApi
        .list(orgSlug, { status: "active" })
        .then(setMembers)
        .catch((err) =>
          setError(userErrorMessage(err, "団員の読み込みに失敗しました。もう一度お試しください。")),
        )
        .finally(() => setLoadingMembers(false));
    }
  };

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const buildFilter = () => {
    if (recipientType === "part") return { partIds: Array.from(selectedPartIds) };
    if (recipientType === "role") return { roles: Array.from(selectedRoles) };
    if (recipientType === "custom") return { memberIds: Array.from(selectedMemberIds) };
    return null;
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (counting) return;
    if (!subject.trim()) {
      setError("件名を入力してください");
      return;
    }
    if (!body.trim()) {
      setError("本文を入力してください");
      return;
    }
    if (recipientType === "part" && selectedPartIds.size === 0) {
      setError("パートを選択してください");
      return;
    }
    if (recipientType === "role" && selectedRoles.size === 0) {
      setError("ロールを選択してください");
      return;
    }
    if (recipientType === "custom" && selectedMemberIds.size === 0) {
      setError("送信先を選択してください");
      return;
    }

    setCounting(true);
    setError(null);
    const recipients = { recipientType, recipientFilter: buildFilter() };
    try {
      const { count } = await mailingApi.recipientCount(orgSlug, recipients);
      if (count === 0) {
        setError("宛先に該当する団員がいません。宛先を選び直してください。");
        return;
      }
      setSendError(null);
      setPendingSend({ count, recipients });
    } catch (err) {
      setError(userErrorMessage(err, "宛先の確認に失敗しました。もう一度お試しください。"));
    } finally {
      setCounting(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!pendingSend) return;
    setSending(true);
    setSendError(null);
    try {
      await mailingApi.send(orgSlug, {
        subject: subject.trim(),
        body: body.trim(),
        ...pendingSend.recipients,
      });
      onSent();
      onClose();
    } catch (err) {
      setSendError(userErrorMessage(err, "送信に失敗しました。もう一度お試しください。"));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Modal
        title="新規メール"
        size="lg"
        onClose={onClose}
        onSubmit={handleSend}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={showTemplatePanel}
                onClick={() => setShowTemplatePanel((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${showTemplatePanel ? "border-brand-300 text-brand-600 bg-brand-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              >
                <BookMarked size={13} />
                テンプレート
              </button>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
              >
                保存
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                aria-busy={counting}
                className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
              >
                {counting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                送信する
              </button>
            </div>
          </div>
        }
      >
        <div>
          <label
            htmlFor="compose-subject"
            className="mb-1.5 block text-xs font-medium text-gray-600"
          >
            件名 <span className="text-red-500">*</span>
          </label>
          <input
            id="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例: 6月練習のご案内"
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="compose-body" className="mb-1.5 block text-xs font-medium text-gray-600">
            本文 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="メール本文を入力..."
            rows={10}
            className="focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:outline-none"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-gray-600">送信先</legend>
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            {RECIPIENT_TABS.map(({ key, label }) => (
              <button
                type="button"
                key={key}
                aria-pressed={recipientType === key}
                onClick={() => handleRecipientTypeChange(key)}
                className={`flex-1 border-r border-gray-200 py-2 text-xs font-medium transition-colors last:border-0 ${
                  recipientType === key
                    ? "bg-brand-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {recipientType === "part" &&
          (loadingParts ? (
            <div className="flex items-center gap-2 py-2 text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">読み込み中...</span>
            </div>
          ) : partsError ? (
            <ErrorMessage autoScroll={false}>
              {userErrorMessage(
                partsError,
                "パートの読み込みに失敗しました。ページを再読み込みしてください。",
              )}
            </ErrorMessage>
          ) : (
            <div className="space-y-1.5">
              {parts.map((p) => (
                <label key={p.id} className={optionClass}>
                  <input
                    type="checkbox"
                    checked={selectedPartIds.has(p.id)}
                    onChange={() => setSelectedPartIds((s) => toggle(s, p.id))}
                    className="accent-brand-600 h-4 w-4 rounded"
                  />
                  <span className="text-sm text-gray-700">{p.name}</span>
                </label>
              ))}
            </div>
          ))}

        {recipientType === "role" && (
          <div className="space-y-1.5">
            {ROLES.filter((r) => r.key !== "visitor").map((r) => (
              <label key={r.key} className={optionClass}>
                <input
                  type="checkbox"
                  checked={selectedRoles.has(r.key)}
                  onChange={() => setSelectedRoles((s) => toggle(s, r.key))}
                  className="accent-brand-600 h-4 w-4 rounded"
                />
                <span className="text-sm text-gray-700">{r.defaultName}</span>
                <span className="text-xs text-gray-400">{r.description}</span>
              </label>
            ))}
          </div>
        )}

        {recipientType === "custom" &&
          (loadingMembers ? (
            <div className="flex items-center gap-2 py-2 text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">読み込み中...</span>
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {members.map((m) => (
                <label key={m.id} className={optionClass}>
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.has(m.id)}
                    onChange={() => setSelectedMemberIds((s) => toggle(s, m.id))}
                    className="accent-brand-600 h-4 w-4 rounded"
                  />
                  <span className="text-sm text-gray-700">{m.nameJa}</span>
                  {m.part && <span className="text-xs text-gray-400">{m.part.name}</span>}
                </label>
              ))}
            </div>
          ))}

        <ErrorMessage>{error}</ErrorMessage>

        {showTemplatePanel && (
          <TemplatePanel
            orgSlug={orgSlug}
            onApply={(t) => {
              setSubject(t.subject);
              setBody(t.body);
            }}
            onClose={() => setShowTemplatePanel(false)}
          />
        )}
      </Modal>

      {pendingSend && (
        <ConfirmDialog
          title={`${pendingSend.count}名にメールを送信しますか？`}
          description={`件名「${subject.trim()}」のメールを送信します。送信したメールは取り消せません。`}
          confirmLabel="送信する"
          tone="primary"
          busy={sending}
          error={sendError}
          onCancel={() => setPendingSend(null)}
          onConfirm={handleConfirmSend}
        />
      )}

      {showSaveModal && (
        <SaveTemplateModal
          orgSlug={orgSlug}
          subject={subject}
          body={body}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
