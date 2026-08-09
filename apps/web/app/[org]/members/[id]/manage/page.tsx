"use client";

import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { settingsApi } from "@/lib/settings-api";
import { memberKeys } from "@/lib/query-keys";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageHeader } from "@/components/PageHeader";
import { PageErrorState } from "@/components/PageErrorState";
import { ProfileCard } from "../_components/ProfileCard";
import { AdminPanel } from "./_components/AdminPanel";

export default function MemberManagePage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { roles: myRoles } = useMember();
  const isAdmin = myRoles.includes("admin");

  const {
    data: member,
    isLoading: memberLoading,
    error: memberError,
  } = useQuery({
    queryKey: memberKeys.detail(org, id),
    queryFn: () => membersApi.get(org, id),
    enabled: isAdmin,
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

  const loading = isAdmin && (memberLoading || partsLoading || typesLoading);

  const handleSave = async (data: Record<string, unknown>) => {
    await membersApi.updateById(org, id, data);
    queryClient.invalidateQueries({ queryKey: memberKeys.list(org) });
    router.push(`/${org}/members/${id}`);
  };

  const handleDelete = async () => {
    if (!confirm(`${member?.nameJa} を退団処理しますか？この操作は取り消せません。`)) return;
    await membersApi.delete(org, id);
    queryClient.invalidateQueries({ queryKey: memberKeys.list(org) });
    router.push(`/${org}/members`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (isAdmin && (memberError || !member)) {
    return (
      <PageErrorState
        title="管理者操作"
        backHref={`/${org}/members/${id}`}
        message={memberError?.message ?? "メンバーが見つかりません"}
      />
    );
  }

  if (!isAdmin || !member) {
    return (
      <div className="flex h-full flex-col">
        <NotFoundPage message="このページにアクセスする権限がありません" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="管理者操作" backHref={`/${org}/members/${id}`} />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:px-8">
        <ProfileCard member={member} />

        <AdminPanel
          member={member}
          parts={parts}
          memberTypes={memberTypes}
          onUpdate={handleSave}
          onDelete={handleDelete}
        />
      </main>
    </div>
  );
}
