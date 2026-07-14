"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PenSquare, Loader2, AlertCircle, Mail } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mailingApi } from "@/lib/mailing-api";
import { membersApi } from "@/lib/members-api";
import { mailingKeys, memberKeys } from "@/lib/query-keys";
import { ComposeModal } from "./_components/ComposeModal";
import { MailCard } from "./_components/MailCard";
import { Pagination } from "@/components/Pagination";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

const PER_PAGE = 20;

export default function MailingPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);

  const {
    data: result,
    isLoading: loading,
    error: mailsError,
  } = useQuery({
    queryKey: mailingKeys.list(org, page),
    queryFn: () => mailingApi.list(org, { page, perPage: PER_PAGE }),
  });

  const { data: parts = [] } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    enabled: showCompose,
  });

  const mails = result?.data ?? [];
  const meta = result?.meta ?? { total: 0, page, perPage: PER_PAGE };

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800">メール</h1>
            {!loading && <span className="text-sm text-gray-400">{meta.total}件</span>}
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            <PenSquare size={14} />
            メールを作成
          </button>
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && mailsError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
            <AlertCircle size={16} />
            <span className="text-sm">{mailsError.message}</span>
          </div>
        )}

        {!loading && !mailsError && mails.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Mail size={28} className="mb-3 opacity-40" />
            <p className="text-sm">メールがありません</p>
          </div>
        )}

        {!loading && !mailsError && mails.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {mails.map((mail) => (
              <MailCard key={mail.id} mail={mail} org={org} />
            ))}
          </div>
        )}

        <Pagination meta={meta} onPageChange={setPage} />
      </PageMain>

      {showCompose && (
        <ComposeModal
          orgSlug={org}
          parts={parts}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setPage(1);
            queryClient.invalidateQueries({ queryKey: mailingKeys.list(org, 1) });
          }}
        />
      )}
    </div>
  );
}
