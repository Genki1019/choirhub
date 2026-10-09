"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Loader2, MapPin } from "lucide-react";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { useQuery } from "@tanstack/react-query";
import { memberKeys } from "@/lib/query-keys";
import { CreateModal } from "./_components/CreateModal";
import { ActivityCard } from "./_components/ActivityCard";
import { PageHeader } from "@/components/PageHeader";
import { PageErrorState } from "@/components/PageErrorState";
import { userErrorMessage } from "@/lib/api-client";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useOutreachActivities } from "@/hooks/useOutreachActivities";
import { canManageTickets } from "@/lib/roles";

export default function OutreachPage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const { roles, memberId } = useMember();
  const [showCreate, setShowCreate] = useState(false);

  const {
    data: activitiesData,
    isLoading: loadingActs,
    error,
    addActivity,
    updateActivity,
    removeActivity,
  } = useOutreachActivities(org, concertId);
  const {
    data: members = [],
    isLoading: loadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: memberKeys.activeList(org),
    queryFn: () => membersApi.list(org, { status: "active" }),
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

  if (!activitiesData) {
    return (
      <PageErrorState
        title="情宣活動"
        backHref={`/${org}/tickets/${concertId}/my`}
        message={userErrorMessage(
          error,
          "読み込みに失敗しました。ページを再読み込みしてください。",
        )}
      />
    );
  }

  const { concert, activities } = activitiesData;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="情宣活動の申請"
        subtitle={<span className="text-sm text-gray-400">{concert.title}</span>}
        backHref={`/${org}/tickets/${concertId}/my`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <Plus size={15} />
            新規申請
          </button>
        }
      />

      <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-6 py-6">
        <ErrorMessage autoScroll={false}>
          {error &&
            userErrorMessage(
              error,
              "最新の情宣活動の読み込みに失敗しました。ページを再読み込みしてください。",
            )}
        </ErrorMessage>
        <ErrorMessage autoScroll={false}>
          {membersError &&
            userErrorMessage(
              membersError,
              "団員一覧の読み込みに失敗したため、新規申請で参加者を選べません。ページを再読み込みしてください。",
            )}
        </ErrorMessage>
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
              canManage={canManageTickets(roles)}
              orgSlug={org}
              concertId={concertId}
              onDeleted={removeActivity}
              onStatusChanged={updateActivity}
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
            addActivity(activity);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
