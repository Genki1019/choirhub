"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PenSquare, Mail } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { mailingApi } from "@/lib/mailing-api";
import { mailingKeys } from "@/lib/query-keys";
import { ComposeModal } from "./_components/ComposeModal";
import { MailCard } from "./_components/MailCard";
import { Pagination } from "@/components/Pagination";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
import { useMember } from "@/contexts/MemberContext";
import { isMemberPlus } from "@/lib/roles";

const PER_PAGE = 20;

export default function MailingPage() {
  const { org } = useParams<{ org: string }>();
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);
  const { roles } = useMember();

  const {
    data: result,
    isLoading: loading,
    isPlaceholderData,
    error: mailsError,
  } = useQuery({
    queryKey: mailingKeys.list(org, page),
    queryFn: () => mailingApi.list(org, { page, perPage: PER_PAGE }),
    placeholderData: keepPreviousData,
  });

  const mails = result?.data ?? [];
  const meta = { total: result?.meta.total ?? 0, page, perPage: PER_PAGE };
  const isCurrent = !!result && !isPlaceholderData;

  return (
    <>
      <PageWithHeader
        title="メール"
        badge={
          isCurrent ? <span className="text-sm text-gray-400">{meta.total}件</span> : undefined
        }
        loading={loading}
        mainClassName="space-y-4"
        actions={
          isMemberPlus(roles) && (
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
            >
              <PenSquare size={14} />
              メールを作成
            </button>
          )
        }
      >
        {mailsError && (
          <ErrorMessage variant="section" autoScroll={false}>
            {userErrorMessage(
              mailsError,
              "メールの読み込みに失敗しました。ページを再読み込みしてください。",
            )}
          </ErrorMessage>
        )}

        {!mailsError && isCurrent && mails.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Mail size={28} className="mb-3 opacity-40" />
            <p className="text-sm">メールがありません</p>
          </div>
        )}

        {!mailsError && mails.length > 0 && (
          <div
            aria-busy={isPlaceholderData}
            className={`overflow-hidden rounded-xl border border-gray-200 bg-white transition-opacity ${
              isPlaceholderData ? "opacity-60" : ""
            }`}
          >
            {mails.map((mail) => (
              <MailCard key={mail.id} mail={mail} org={org} />
            ))}
          </div>
        )}

        <Pagination meta={meta} onPageChange={setPage} />
      </PageWithHeader>

      {showCompose && (
        <ComposeModal
          orgSlug={org}
          onClose={() => setShowCompose(false)}
          onSent={() => setPage(1)}
        />
      )}
    </>
  );
}
