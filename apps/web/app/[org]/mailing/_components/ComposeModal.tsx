"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send, BookMarked } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mailingApi, type RecipientType, type SendMailInput } from "@/lib/mailing-api";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { homeKeys, mailingKeys, memberKeys } from "@/lib/query-keys";
import { ROLES } from "@/lib/roles";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SaveTemplateModal } from "./SaveTemplateModal";
import { TemplatePanel } from "./TemplatePanel";
import { userErrorMessage } from "@/lib/api-client";

const RECIPIENT_TABS: { key: RecipientType; label: string }[] = [
  { key: "all", label: "全員" },
  { key: "part", label: "パート" },
  { key: "role", label: "ロール" },
  { key: "custom", label: "個別" },
];

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

  const queryClient = useQueryClient();
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
      void queryClient.invalidateQueries({ queryKey: mailingKeys.all(orgSlug) });
      void queryClient.invalidateQueries({ queryKey: homeKeys.get(orgSlug) });
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
                テンプレートに保存
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
          onSaved={() =>
            queryClient.invalidateQueries({ queryKey: mailingKeys.templates(orgSlug) })
          }
        />
      )}
    </>
  );
}
