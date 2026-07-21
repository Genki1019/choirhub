"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  UserPlus,
  UserRoundPlus,
  Loader2,
  AlertCircle,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import { useMember } from "@/contexts/MemberContext";
import { settingsApi } from "@/lib/settings-api";
import { memberKeys, visitorApplicationKeys } from "@/lib/query-keys";
import { MEMBER_STATUS_OPTIONS } from "@/lib/api-types";
import type { MemberStatus } from "@/lib/api-types";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { comparePartOrder } from "@/lib/voice-order";
import { InviteModal, InviteSuccessModal } from "./_components/InviteModal";
import {
  AddVisitorApplicationModal,
  AddVisitorApplicationSuccessModal,
} from "./_components/AddVisitorApplicationModal";
import { MemberPartSection } from "./_components/MemberPartSection";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { PageHeader } from "@/components/PageHeader";

type SortKey = "nameJa" | "joinedAt_asc" | "joinedAt_desc";
type ViewMode = "card" | "list";
type StatusFilter = "all" | MemberStatus;

// ── ユーティリティ ──

function sortMembers(a: MemberProfile, b: MemberProfile, key: SortKey): number {
  if (key === "nameJa") {
    // nameKana（フリガナ）が登録されている場合はそちらで比較し、読み順で正確にソートする
    const ka = a.nameKana ?? a.nameJa;
    const kb = b.nameKana ?? b.nameJa;
    return ka.localeCompare(kb, "ja");
  }
  const da = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
  const db = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
  return key === "joinedAt_asc" ? da - db : db - da;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "nameJa", label: "名前順" },
  { value: "joinedAt_asc", label: "在籍歴が長い順" },
  { value: "joinedAt_desc", label: "入団が新しい順" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全員" },
  ...MEMBER_STATUS_OPTIONS,
];

// ── メインページ ──

function MembersContent() {
  const { org } = useParams<{ org: string }>();
  const searchParams = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("nameJa");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [isMobile, setIsMobile] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "active",
  );
  const [memberTypeFilter, setMemberTypeFilter] = useState<string>("all");
  const { roles: myRoles } = useMember();
  const [showInvite, setShowInvite] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [showAddVisitorSuccess, setShowAddVisitorSuccess] = useState(false);

  const isAdmin = myRoles.includes("admin");
  const canAddVisitor = myRoles.some((r) => MEMBER_LEVEL_ROLES.has(r));

  const { data: pendingApplications = [] } = useQuery({
    queryKey: visitorApplicationKeys.pending(org),
    queryFn: () => visitorApplicationsApi.listPending(org),
    enabled: isAdmin,
  });

  const {
    data: members = [],
    isLoading: membersLoading,
    error: membersError,
  } = useQuery({
    queryKey: memberKeys.list(org),
    queryFn: () => membersApi.list(org),
  });
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
  });
  const { data: memberTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn: () => settingsApi.listMemberTypes(org),
  });

  const loading = membersLoading || partsLoading || typesLoading;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const effectiveViewMode: ViewMode = isMobile ? "card" : viewMode;

  const grouped = useMemo(() => {
    const isFiltering = statusFilter !== "all" || memberTypeFilter !== "all";

    const filtered = members.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (memberTypeFilter === "__none__" && m.memberType !== null) return false;
      if (
        memberTypeFilter !== "all" &&
        memberTypeFilter !== "__none__" &&
        m.memberType?.id !== memberTypeFilter
      )
        return false;
      return true;
    });

    // フィルタ中は全パートを表示、非フィルタ中は filtered に存在するパートのみ
    const baseParts = isFiltering
      ? [...parts].sort(comparePartOrder)
      : (() => {
          const partMap = new Map<
            string,
            { id: string; name: string; voiceType: string; sortOrder: number }
          >();
          filtered.forEach((m) => {
            if (m.part && !partMap.has(m.part.id)) partMap.set(m.part.id, m.part);
          });
          return Array.from(partMap.values()).sort(comparePartOrder);
        })();

    const groups = baseParts.map((part) => ({
      partId: part.id,
      partName: part.name,
      members: filtered
        .filter((m) => m.part?.id === part.id)
        .sort((a, b) => sortMembers(a, b, sortKey)),
    }));

    // パート未設定: フィルタ中は全体に未設定がいれば表示、非フィルタ中は filtered に存在する場合のみ
    const unassigned = filtered.filter((m) => !m.part).sort((a, b) => sortMembers(a, b, sortKey));
    const showUnassigned = isFiltering ? members.some((m) => !m.part) : unassigned.length > 0;
    if (showUnassigned) {
      groups.push({ partId: "__unassigned__", partName: "パート未設定", members: unassigned });
    }

    return groups;
  }, [members, parts, sortKey, statusFilter, memberTypeFilter]);

  const totalCount = grouped.reduce((s, g) => s + g.members.length, 0);

  return (
    <>
      {showInvite && (
        <InviteModal
          org={org}
          parts={parts}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            setShowInviteSuccess(true);
          }}
        />
      )}
      {showInviteSuccess && <InviteSuccessModal onClose={() => setShowInviteSuccess(false)} />}
      {showAddVisitor && (
        <AddVisitorApplicationModal
          org={org}
          parts={parts}
          onClose={() => setShowAddVisitor(false)}
          onSuccess={() => {
            setShowAddVisitor(false);
            setShowAddVisitorSuccess(true);
          }}
        />
      )}
      {showAddVisitorSuccess && (
        <AddVisitorApplicationSuccessModal onClose={() => setShowAddVisitorSuccess(false)} />
      )}
      <div className="flex flex-col">
        <PageHeader
          title="メンバー"
          actions={
            isAdmin || canAddVisitor ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link
                    href={`/${org}/members/applications`}
                    className="relative flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    見学申込
                    {pendingApplications.length > 0 && (
                      <span className="bg-brand-600 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
                        {pendingApplications.length}
                      </span>
                    )}
                  </Link>
                )}
                {canAddVisitor && (
                  <button
                    onClick={() => setShowAddVisitor(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <UserRoundPlus size={14} />
                    見学者を追加
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowInvite(true)}
                    className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
                  >
                    <UserPlus size={14} />
                    メンバーを招待
                  </button>
                )}
              </div>
            ) : undefined
          }
        />

        {/* コントロールバー */}
        <div className="shrink-0 border-b border-gray-100 bg-white">
          <PageBleedRow className="flex flex-wrap items-center justify-between gap-y-2 py-3">
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:ring-1 focus:outline-none"
              >
                {STATUS_FILTERS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {memberTypes.length > 0 && (
                <select
                  value={memberTypeFilter}
                  onChange={(e) => setMemberTypeFilter(e.target.value)}
                  className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:ring-1 focus:outline-none"
                >
                  <option value="all">全区分</option>
                  {memberTypes.map(({ id, name }) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                  <option value="__none__">未設定</option>
                </select>
              )}
              {!loading && <span className="text-xs text-gray-400">{totalCount}名</span>}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="focus:ring-brand-400 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:ring-1 focus:outline-none"
              >
                {SORT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <div className="hidden overflow-hidden rounded-lg border border-gray-200 sm:flex">
                <button
                  onClick={() => setViewMode("card")}
                  className={`p-1.5 transition-colors ${viewMode === "card" ? "bg-brand-600 text-white" : "text-gray-400 hover:bg-gray-50"}`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-brand-600 text-white" : "text-gray-400 hover:bg-gray-50"}`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </PageBleedRow>
        </div>

        {/* メインコンテンツ */}
        <PageMain className="space-y-8">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">読み込み中...</span>
            </div>
          )}

          {!loading && membersError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
              <AlertCircle size={16} />
              <span className="text-sm">{membersError.message}</span>
            </div>
          )}

          {!loading && !membersError && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users size={40} className="mb-3 opacity-40" />
              <p className="text-sm">該当するメンバーがいません</p>
            </div>
          )}

          {!loading &&
            !membersError &&
            grouped.map(({ partId, partName, members: partMembers }) => (
              <MemberPartSection
                key={partId}
                partId={partId}
                partName={partName}
                members={partMembers}
                viewMode={effectiveViewMode}
                org={org}
              />
            ))}
        </PageMain>
      </div>
    </>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      }
    >
      <MembersContent />
    </Suspense>
  );
}
