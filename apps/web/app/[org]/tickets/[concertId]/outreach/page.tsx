"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, AlertCircle, MapPin } from "lucide-react";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketKeys, memberKeys } from "@/lib/query-keys";
import { CreateModal } from "./_components/CreateModal";
import { ActivityCard } from "./_components/ActivityCard";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function OutreachPage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const queryClient = useQueryClient();
  const { roles, memberId } = useMember();
  const [showCreate, setShowCreate] = useState(false);

  const {
    data: activities = [],
    isLoading: loadingActs,
    error,
  } = useQuery({
    queryKey: ticketKeys.outreach(org, concertId),
    queryFn: () => ticketsApi.listOutreachActivities(org, concertId),
  });
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: memberKeys.activeList(org),
    queryFn: () => membersApi.list(org, { status: "active" }),
  });
  const { data: concertTitle = "" } = useQuery({
    queryKey: ticketKeys.detail(org, concertId),
    queryFn: () => ticketsApi.get(org, concertId),
    select: (d) => d.concert.title,
  });
  const loading = loadingActs || loadingMembers;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{error?.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/${org}/tickets/${concertId}/my`}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">情宣活動の申請</h1>
              <p className="text-sm text-gray-400">{concertTitle}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <Plus size={15} />
            新規申請
          </button>
        </PageBleedRow>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-6 py-6">
        {activities.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <MapPin size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">情宣活動の申請がありません</p>
            <p className="mt-1 text-xs">「新規申請」から追加してください</p>
          </div>
        ) : (
          activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              myMemberId={memberId}
              isAdmin={roles.includes("admin") || roles.includes("ticket")}
              orgSlug={org}
              concertId={concertId}
              onDeleted={(id) =>
                queryClient.setQueryData<OutreachActivityRow[]>(
                  ticketKeys.outreach(org, concertId),
                  (prev) => (prev ? prev.filter((x) => x.id !== id) : prev),
                )
              }
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
          onCreated={(activity) => {
            queryClient.setQueryData<OutreachActivityRow[]>(
              ticketKeys.outreach(org, concertId),
              (prev) => (prev ? [activity, ...prev] : prev),
            );
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
