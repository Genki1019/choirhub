"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { memberKeys } from "@/lib/query-keys";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { ProfileCard } from "./_components/ProfileCard";
import { ProfileInfoSection } from "./_components/ProfileInfoSection";
import { EditForm } from "./_components/EditForm";
import { PageHeader } from "@/components/PageHeader";

export default function MemberDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const queryClient = useQueryClient();

  const { roles: myRoles, memberId: myMemberId } = useMember();
  const [isEditing, setIsEditing] = useState(false);

  const isSelf = myMemberId === id;
  const isAdmin = myRoles.includes("admin");
  const isMemberPlus = myRoles.some((r) => MEMBER_LEVEL_ROLES.has(r));

  const {
    data: member,
    isLoading: memberLoading,
    error: memberError,
  } = useQuery({
    queryKey: memberKeys.detail(org, id),
    queryFn: () => membersApi.get(org, id),
  });

  const handleSelfSave = async (data: Record<string, unknown>) => {
    const updated = await membersApi.updateMe(org, data as Partial<MemberProfile>);
    queryClient.setQueryData(memberKeys.detail(org, id), updated);
    queryClient.invalidateQueries({ queryKey: memberKeys.list(org) });
    setIsEditing(false);
  };

  if (memberLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (memberError || !member) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{memberError?.message ?? "メンバーが見つかりません"}</span>
        </div>
      </div>
    );
  }

  const hasActions = (isSelf && !isEditing) || isAdmin;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="メンバー詳細"
        backHref={`/${org}/members`}
        actions={
          hasActions ? (
            <>
              {isSelf && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Pencil size={14} /> 編集
                </button>
              )}
              {isAdmin && (
                <Link
                  href={`/${org}/members/${id}/manage`}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <ShieldCheck size={14} /> 管理者操作
                </Link>
              )}
            </>
          ) : undefined
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:px-8">
        <ProfileCard member={member} />

        {!isEditing && (
          <ProfileInfoSection member={member} isMemberPlus={isMemberPlus} isAdmin={isAdmin} />
        )}

        {isEditing && (
          <EditForm
            member={member}
            org={org}
            onSave={handleSelfSave}
            onCancel={() => setIsEditing(false)}
          />
        )}
      </main>
    </div>
  );
}
