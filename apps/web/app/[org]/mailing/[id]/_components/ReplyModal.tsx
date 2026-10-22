"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { mailingApi } from "@/lib/mailing-api";
import { userErrorMessage } from "@/lib/api-client";
import { homeKeys, mailingKeys } from "@/lib/query-keys";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ReplyTarget = "sender" | "all";

export function ReplyModal({
  orgSlug,
  senderMemberId,
  senderName,
  allMemberIds,
  originalSubject,
  onClose,
  onSent,
}: {
  orgSlug: string;
  senderMemberId: string;
  senderName: string;
  allMemberIds: string[];
  originalSubject: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState(`Re: ${originalSubject}`);
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>("sender");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const [pendingSend, setPendingSend] = useState<{ count: number; memberIds: string[] } | null>(
    null,
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const recipientCount = replyTarget === "sender" ? 1 : allMemberIds.length;

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
    setCounting(true);
    setError(null);
    const memberIds = replyTarget === "sender" ? [senderMemberId] : allMemberIds;
    try {
      const { count } = await mailingApi.recipientCount(orgSlug, {
        recipientType: "custom",
        recipientFilter: { memberIds },
      });
      if (count === 0) {
        setError("宛先に該当する団員がいません。");
        return;
      }
      setSendError(null);
      setPendingSend({ count, memberIds });
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
        recipientType: "custom",
        recipientFilter: { memberIds: pendingSend.memberIds },
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

  const targetClass = (active: boolean) =>
    `flex-1 py-2 text-xs font-medium transition-colors ${
      active ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
    }`;

  return (
    <>
      <Modal
        title="返信"
        size="lg"
        onClose={onClose}
        onSubmit={handleSend}
        footer={
          <>
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
              {recipientCount}名に送信
            </button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-gray-600">返信先</legend>
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            <button
              type="button"
              aria-pressed={replyTarget === "sender"}
              onClick={() => setReplyTarget("sender")}
              className={`border-r border-gray-200 ${targetClass(replyTarget === "sender")}`}
            >
              送信者のみ（{senderName}）
            </button>
            <button
              type="button"
              aria-pressed={replyTarget === "all"}
              onClick={() => setReplyTarget("all")}
              className={targetClass(replyTarget === "all")}
            >
              全員に返信（{allMemberIds.length}名）
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {replyTarget === "sender"
              ? `${senderName} 1名に送信します`
              : `送信者・受信者 ${recipientCount}名全員に送信します`}
          </p>
        </fieldset>

        <div>
          <label htmlFor="reply-subject" className="mb-1.5 block text-xs font-medium text-gray-600">
            件名
          </label>
          <input
            id="reply-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="reply-body" className="mb-1.5 block text-xs font-medium text-gray-600">
            本文 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="reply-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="返信内容を入力..."
            rows={10}
            className="focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:outline-none"
          />
        </div>

        <ErrorMessage>{error}</ErrorMessage>
      </Modal>

      {pendingSend && (
        <ConfirmDialog
          title={`${pendingSend.count}名に返信しますか？`}
          description={`件名「${subject.trim()}」のメールを送信します。送信したメールは取り消せません。`}
          confirmLabel="送信する"
          tone="primary"
          busy={sending}
          error={sendError}
          onCancel={() => setPendingSend(null)}
          onConfirm={handleConfirmSend}
        />
      )}
    </>
  );
}
