"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, AlertCircle, MapPin } from "lucide-react";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";
import { membersApi } from "@/lib/members-api";
import { concertsApi } from "@/lib/concerts-api";
import type { MemberProfile } from "@/lib/api-types";
import { ApiClientError } from "@/lib/api-client";
import { CreateModal } from "./_components/CreateModal";
import { ActivityCard } from "./_components/ActivityCard";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function OutreachPage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const router = useRouter();

  const [activities,    setActivities]    = useState<OutreachActivityRow[]>([]);
  const [members,       setMembers]       = useState<MemberProfile[]>([]);
  const [myMemberId,    setMyMemberId]    = useState("");
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [concertTitle,  setConcertTitle]  = useState("");
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [showCreate,    setShowCreate]    = useState(false);

  useEffect(() => {
    Promise.all([
      ticketsApi.listOutreachActivities(org, concertId),
      membersApi.list(org, { status: "active" }),
      membersApi.me(org),
      concertsApi.list(org),
    ])
      .then(([acts, mems, me, concerts]) => {
        setActivities(acts);
        setMembers(mems);
        setMyMemberId(me.id);
        setIsAdmin(me.roles.includes("admin") || me.roles.includes("ticket"));
        const concert = concerts.find((c) => c.id === concertId);
        setConcertTitle(concert?.title ?? "");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, concertId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Link href={`/${org}/tickets/${concertId}/my`} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">情宣活動の申請</h1>
              <p className="text-sm text-gray-400">{concertTitle}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            新規申請
          </button>
        </PageBleedRow>
      </header>

      <main className="flex-1 px-6 py-6 space-y-3 max-w-lg mx-auto w-full">
        {activities.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MapPin size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">情宣活動の申請がありません</p>
            <p className="text-xs mt-1">「新規申請」から追加してください</p>
          </div>
        ) : (
          activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              myMemberId={myMemberId}
              isAdmin={isAdmin}
              orgSlug={org}
              concertId={concertId}
              onDeleted={(id) => setActivities((prev) => prev.filter((x) => x.id !== id))}
            />
          ))
        )}
      </main>

      {showCreate && (
        <CreateModal
          orgSlug={org}
          concertId={concertId}
          members={members}
          onClose={() => setShowCreate(false)}
          onCreated={(activity) => { setActivities((prev) => [activity, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
