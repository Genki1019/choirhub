"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Loader2, AlertCircle, Reply, Send, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { mailingApi, LAST_EVENT_LABEL } from "@/lib/mailing-api";
import { ApiClientError } from "@/lib/api-client";
import { mailingKeys } from "@/lib/query-keys";
import { formatJaDateTime } from "@/lib/date";
import { PageBleedRow } from "@/components/PageBleedRow";

type ReplyTarget = "sender" | "all";

function ReplyModal({ orgSlug, senderMemberId, senderName, allMemberIds, originalSubject, onClose, onSent }: {
  orgSlug: string;
  senderMemberId: string;
  senderName: string;
  allMemberIds: string[];
  originalSubject: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject]         = useState(`Re: ${originalSubject}`);
  const [body, setBody]               = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>("sender");
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const recipientCount = replyTarget === "sender" ? 1 : allMemberIds.length;

  const handleSend = async () => {
    if (!subject.trim()) { setError("件名を入力してください"); return; }
    if (!body.trim())    { setError("本文を入力してください"); return; }
    setSending(true);
    setError(null);
    try {
      const memberIds = replyTarget === "sender" ? [senderMemberId] : allMemberIds;
      await mailingApi.send(orgSlug, {
        subject: subject.trim(),
        body: body.trim(),
        recipientType: "custom",
        recipientFilter: { memberIds },
      });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Reply size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800 text-sm">返信</h2>
          </div>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">返信先</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setReplyTarget("sender")}
                className={`flex-1 py-2 text-xs font-medium transition-colors border-r border-gray-200 ${
                  replyTarget === "sender" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                送信者のみ（{senderName}）
              </button>
              <button
                onClick={() => setReplyTarget("all")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  replyTarget === "all" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                全員に返信（{allMemberIds.length}名）
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {replyTarget === "sender"
                ? `${senderName} 1名に送信します`
                : `送信者・受信者 ${recipientCount}名全員に送信します`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">件名</label>
            <input
              value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">本文 <span className="text-red-500">*</span></label>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="返信内容を入力..."
              rows={10}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">キャンセル</button>
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {recipientCount}名に送信
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start px-6 py-3 gap-4">
      <dt className="text-xs font-medium text-gray-400 w-20 shrink-0 pt-0.5">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}

export default function MailDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();
  const [showReply, setShowReply] = useState(false);

  const { data: mail, isLoading: loading, error: queryError } = useQuery({
    queryKey: mailingKeys.detail(org, id),
    queryFn:  () => mailingApi.get(org, id),
  });

  useEffect(() => {
    if (queryError instanceof ApiClientError && queryError.status === 404) {
      router.push(`/${org}/mailing`);
    }
  }, [queryError, org, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (queryError || !mail) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{queryError?.message ?? "メールが見つかりません"}</span>
        </div>
      </div>
    );
  }

  const subject  = mail.resend?.subject ?? "（件名なし）";
  const eventCfg = mail.resend
    ? (LAST_EVENT_LABEL[mail.resend.lastEvent] ?? { label: mail.resend.lastEvent, color: "text-gray-500 bg-gray-50" })
    : null;

  return (
    <>
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center gap-4 py-4">
          <Link href={`/${org}/mailing`} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-gray-800 truncate flex-1">{subject}</h1>
          <button
            onClick={() => setShowReply(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
          >
            <Reply size={14} />返信
          </button>
        </PageBleedRow>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-6 space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{subject}</h2>
            {eventCfg && (
              <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${eventCfg.color}`}>
                {eventCfg.label}
              </span>
            )}
          </div>

          <dl className="divide-y divide-gray-100">
            <MetaRow label="送信者">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {mail.sentBy.nameJa.charAt(0)}
                </div>
                <span className="text-sm text-gray-800">{mail.sentBy.nameJa}</span>
              </div>
            </MetaRow>

            <MetaRow label="送信日時">
              <span className="text-sm text-gray-700">{formatJaDateTime(mail.sentAt)}</span>
            </MetaRow>

            <MetaRow label="受信者数">
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                <Users size={13} className="text-gray-400" />{mail.recipientCount}名
              </span>
            </MetaRow>
          </dl>
        </div>

        {mail.resend ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
            {mail.resend.html ? (
              <iframe
                srcDoc={mail.resend.html}
                sandbox=""
                className="w-full min-h-72 border-0 rounded"
                title="メール本文"
              />
            ) : (
              <pre className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                {mail.resend.text ?? "（本文なし）"}
              </pre>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-6 py-8 text-center text-gray-400 text-sm">
            Resend が未設定のため本文を取得できません
          </div>
        )}

        {mail.recipients.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">配信ステータス</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {mail.recipients.map((r) => {
                const cfg = LAST_EVENT_LABEL[r.lastEvent] ?? { label: r.lastEvent, color: "text-gray-500 bg-gray-50" };
                return (
                  <div key={r.email} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm text-gray-700">{r.email}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>

    {showReply && (
      <ReplyModal
        orgSlug={org}
        senderMemberId={mail.sentBy.id}
        senderName={mail.sentBy.nameJa}
        allMemberIds={[...new Set([mail.sentBy.id, ...mail.recipientMemberIds])]}
        originalSubject={subject}
        onClose={() => setShowReply(false)}
        onSent={() => router.push(`/${org}/mailing`)}
      />
    )}
    </>
  );
}
