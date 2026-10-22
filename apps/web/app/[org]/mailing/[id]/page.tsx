"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, Reply } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { mailingApi, LAST_EVENT_LABEL } from "@/lib/mailing-api";
import { userErrorMessage } from "@/lib/api-client";
import { mailingKeys } from "@/lib/query-keys";
import { formatJaDateTime } from "@/lib/date";
import { PageHeader } from "@/components/PageHeader";
import { ReplyModal } from "./_components/ReplyModal";
import { PageWithHeader } from "@/components/PageWithHeader";
import { PageErrorState } from "@/components/PageErrorState";
import { useMember } from "@/contexts/MemberContext";
import { isMemberPlus } from "@/lib/roles";

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-6 py-3">
      <dt className="w-20 shrink-0 pt-0.5 text-xs font-medium text-gray-400">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}

export default function MailDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();
  const [showReply, setShowReply] = useState(false);
  const { memberId, roles } = useMember();

  const {
    data: mail,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: mailingKeys.detail(org, id),
    queryFn: () => mailingApi.get(org, id),
  });

  if (loading) {
    return (
      <PageWithHeader title="メール" backHref={`/${org}/mailing`} loading>
        {null}
      </PageWithHeader>
    );
  }

  if (queryError || !mail) {
    return (
      <PageErrorState
        title="メール"
        backHref={`/${org}/mailing`}
        message={userErrorMessage(
          queryError,
          "メールの読み込みに失敗しました。ページを再読み込みしてください。",
        )}
      />
    );
  }

  const subject = mail.resend?.subject ?? "（件名なし）";
  const eventCfg =
    mail.resend?.lastEvent && mail.sentBy.id === memberId
      ? (LAST_EVENT_LABEL[mail.resend.lastEvent] ?? {
          label: mail.resend.lastEvent,
          color: "text-gray-500 bg-gray-50",
        })
      : null;

  return (
    <>
      <div className="flex flex-col">
        <PageHeader
          title={subject}
          backHref={`/${org}/mailing`}
          actions={
            isMemberPlus(roles) && (
              <button
                type="button"
                onClick={() => setShowReply(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
              >
                <Reply size={14} />
                返信
              </button>
            )
          }
        />

        <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-8">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">{subject}</h2>
              {eventCfg && (
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${eventCfg.color}`}
                >
                  {eventCfg.label}
                </span>
              )}
            </div>

            <dl className="divide-y divide-gray-100">
              <MetaRow label="送信者">
                <div className="flex items-center gap-2">
                  <div className="bg-brand-100 text-brand-600 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
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
                  <Users size={13} className="text-gray-400" />
                  {mail.recipientCount}名
                </span>
              </MetaRow>
            </dl>
          </div>

          {mail.resend ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              {mail.resend.html ? (
                <iframe
                  srcDoc={mail.resend.html}
                  sandbox=""
                  className="min-h-72 w-full rounded border-0"
                  title="メール本文"
                />
              ) : (
                <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                  {mail.resend.text ?? "（本文なし）"}
                </pre>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-400">
              Resend が未設定のため本文を取得できません
            </div>
          )}

          {mail.recipients.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-6 py-3">
                <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  配信ステータス
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {mail.recipients.map((r) => {
                  const cfg = LAST_EVENT_LABEL[r.lastEvent] ?? {
                    label: r.lastEvent,
                    color: "text-gray-500 bg-gray-50",
                  };
                  return (
                    <div key={r.email} className="flex items-center justify-between px-6 py-3">
                      <span className="text-sm text-gray-700">{r.email}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
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
