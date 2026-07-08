"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { settingsApi } from "@/lib/settings-api";
import { memberKeys } from "@/lib/query-keys";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { ProfileCard } from "./_components/ProfileCard";
import { ProfileInfoSection } from "./_components/ProfileInfoSection";
import { EditForm } from "./_components/EditForm";
import { AdminPanel } from "./_components/AdminPanel";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function MemberDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { roles: myRoles, memberId: myMemberId } = useMember();
  const [isEditing, setIsEditing] = useState(false);

  const isSelf       = myMemberId === id;
  const isAdmin      = myRoles.includes("admin");
  const isMemberPlus = myRoles.some(r => MEMBER_LEVEL_ROLES.has(r));

  const { data: member, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: memberKeys.detail(org, id),
    queryFn: () => membersApi.get(org, id),
  });
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    enabled: isAdmin,
  });
  const { data: memberTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn: () => settingsApi.listMemberTypes(org),
    enabled: isAdmin,
  });

  const loading = memberLoading || (isAdmin && (partsLoading || typesLoading));

  const handleSelfSave = async (data: Record<string, unknown>) => {
    const updated = await membersApi.updateMe(org, data as Partial<MemberProfile>);
    queryClient.setQueryData(memberKeys.detail(org, id), updated);
    queryClient.invalidateQueries({ queryKey: memberKeys.list(org) });
    setIsEditing(false);
  };

  const handleAdminSave = async (data: Record<string, unknown>) => {
    await membersApi.updateById(org, id, data);
    queryClient.invalidateQueries({ queryKey: memberKeys.list(org) });
    const savedStatus = (data.status as string) ?? member?.status ?? "active";
    router.push(`/${org}/members?status=${savedStatus}`);
  };

  const handleAdminDelete = async () => {
    if (!confirm(`${member?.nameJa} を退団処理しますか？この操作は取り消せません。`)) return;
    await membersApi.delete(org, id);
    queryClient.invalidateQueries({ queryKey: memberKeys.list(org) });
    router.push(`/${org}/members`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (memberError || !member) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{memberError?.message ?? "メンバーが見つかりません"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Link href={`/${org}/members`} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-gray-800">メンバー詳細</h1>
          </div>
          {isSelf && !isEditing && (
            <button onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Pencil size={14} /> 編集
            </button>
          )}
        </PageBleedRow>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
        <ProfileCard member={member} />

        {!isEditing && (
          <ProfileInfoSection
            member={member}
            isMemberPlus={isMemberPlus}
            isAdmin={isAdmin}
          />
        )}

        {isEditing && (
          <EditForm
            member={member}
            org={org}
            onSave={handleSelfSave}
            onCancel={() => setIsEditing(false)}
          />
        )}

        {isAdmin && (
          <AdminPanel member={member} parts={parts} memberTypes={memberTypes} onUpdate={handleAdminSave} onDelete={handleAdminDelete} />
        )}
      </main>
    </div>
  );
}
