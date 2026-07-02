"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PenSquare, Loader2, AlertCircle, Mail } from "lucide-react";
import { mailingApi, type MailSummary, type MailListMeta } from "@/lib/mailing-api";
import { ApiClientError } from "@/lib/api-client";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { ComposeModal } from "./_components/ComposeModal";
import { MailCard } from "./_components/MailCard";
import { Pagination } from "@/components/Pagination";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function MailingPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();

  const [mails, setMails]             = useState<MailSummary[]>([]);
  const [meta, setMeta]               = useState<MailListMeta>({ total: 0, page: 1, perPage: 20 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [parts, setParts]             = useState<PartSummary[]>([]);
  const [showCompose, setShowCompose] = useState(false);

  const fetchMails = useCallback((page: number) => {
    mailingApi.list(org, { page, perPage: 20 })
      .then((res) => {
        setMails(res.data);
        setMeta(res.meta);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    membersApi.parts(org).then((p) => { if (!cancelled) setParts(p); }).catch(() => {});
    mailingApi.list(org, { page: 1, perPage: 20 })
      .then((res) => { if (!cancelled) { setMails(res.data); setMeta(res.meta); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org, router]);

  const handlePageChange = (page: number) => {
    setLoading(true);
    setError(null);
    fetchMails(page);
  };

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800">メール</h1>
            {!loading && <span className="text-sm text-gray-400">{meta.total}件</span>}
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PenSquare size={14} />メールを作成
          </button>
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} /><span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && mails.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Mail size={28} className="mb-3 opacity-40" />
            <p className="text-sm">メールがありません</p>
          </div>
        )}

        {!loading && !error && mails.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {mails.map((mail) => <MailCard key={mail.id} mail={mail} org={org} />)}
          </div>
        )}

        <Pagination meta={meta} onPageChange={handlePageChange} />
      </PageMain>

      {showCompose && (
        <ComposeModal
          orgSlug={org} parts={parts}
          onClose={() => setShowCompose(false)}
          onSent={() => fetchMails(1)}
        />
      )}
    </div>
  );
}
