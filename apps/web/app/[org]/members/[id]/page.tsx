"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Loader2, AlertCircle } from "lucide-react";
import { membersApi, type MemberProfile, type PartSummary } from "@/lib/members-api";
import { settingsApi, type MemberType } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { ProfileCard } from "./_components/ProfileCard";
import { ProfileInfoSection } from "./_components/ProfileInfoSection";
import { EditForm } from "./_components/EditForm";
import { AdminPanel } from "./_components/AdminPanel";

export default function MemberDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();

  const [member,      setMember]      = useState<MemberProfile | null>(null);
  const [myMemberId,  setMyMemberId]  = useState<string | null>(null);
  const [myRoles,     setMyRoles]     = useState<string[]>([]);
  const [parts,       setParts]       = useState<PartSummary[]>([]);
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [isEditing,   setIsEditing]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([membersApi.get(org, id), membersApi.me(org), membersApi.parts(org), settingsApi.listMemberTypes(org)])
      .then(([memberData, meData, partsData, typesData]) => {
        if (cancelled) return;
        setMember(memberData);
        setMyMemberId(meData.id);
        setMyRoles(meData.roles);
        setParts(partsData);
        setMemberTypes(typesData);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org, id, router]);

  const isSelf       = myMemberId === id;
  const isAdmin      = myRoles.includes("admin");
  const isMemberPlus = myRoles.some(r => MEMBER_LEVEL_ROLES.has(r));

  const handleSelfSave = async (data: Record<string, unknown>) => {
    const updated = await membersApi.updateMe(org, data as Partial<MemberProfile>);
    setMember(updated);
    setIsEditing(false);
  };

  const handleAdminSave = async (data: Record<string, unknown>) => {
    await membersApi.updateById(org, id, data);
    const savedStatus = (data.status as string) ?? member?.status ?? "active";
    router.push(`/${org}/members?status=${savedStatus}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error ?? "メンバーが見つかりません"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
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

        {isAdmin && !isSelf && (
          <AdminPanel member={member} parts={parts} memberTypes={memberTypes} onUpdate={handleAdminSave} />
        )}
      </main>
    </div>
  );
}
