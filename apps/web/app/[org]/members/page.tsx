"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, UserPlus, Loader2, AlertCircle, Users } from "lucide-react";
import { membersApi, type MemberProfile, type PartSummary } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import type { MemberStatus } from "@/lib/api-types";
import { comparePartOrder } from "@/lib/voice-order";
import { InviteModal, InviteSuccessModal } from "./_components/InviteModal";
import { MemberPartSection } from "./_components/MemberPartSection";

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
  { value: "nameJa",       label: "名前順" },
  { value: "joinedAt_asc", label: "在籍歴が長い順" },
  { value: "joinedAt_desc",label: "入団が新しい順" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",      label: "全員" },
  { value: "active",   label: "在団" },
  { value: "offstage", label: "休団" },
  { value: "alumni",   label: "OB" },
];

// ── メインページ ──

function MembersContent() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("nameJa");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [isMobile, setIsMobile] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "active"
  );
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);

  const [prevOrg, setPrevOrg] = useState(org);
  if (prevOrg !== org) {
    setPrevOrg(org);
    setLoading(true);
    setError(null);
  }

  const isAdmin = myRoles.includes("admin");

  useEffect(() => {
    let cancelled = false;

    Promise.all([membersApi.list(org), membersApi.me(org), membersApi.parts(org)])
      .then(([memberData, meData, partsData]) => {
        if (!cancelled) {
          setMembers(memberData);
          setMyRoles(meData.roles);
          setParts(partsData);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [org, router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const effectiveViewMode: ViewMode = isMobile ? "card" : viewMode;

  const grouped = useMemo(() => {
    const filtered = members.filter(
      (m) => statusFilter === "all" || m.status === statusFilter
    );

    // パートを voiceType / sortOrder 順に並べるためにマップで収集
    const partMap = new Map<string, { id: string; name: string; voiceType: string; sortOrder: number }>();
    filtered.forEach((m) => {
      if (m.part && !partMap.has(m.part.id)) {
        partMap.set(m.part.id, m.part);
      }
    });

    const groups = Array.from(partMap.values())
      .sort(comparePartOrder)
      .map((part) => ({
        partId: part.id,
        partName: part.name,
        members: filtered
          .filter((m) => m.part?.id === part.id)
          .sort((a, b) => sortMembers(a, b, sortKey)),
      }))
      .filter((g) => g.members.length > 0);

    // パート未設定のメンバーを末尾に追加
    const unassigned = filtered
      .filter((m) => !m.part)
      .sort((a, b) => sortMembers(a, b, sortKey));
    if (unassigned.length > 0) {
      groups.push({ partId: "__unassigned__", partName: "パート未設定", members: unassigned });
    }

    return groups;
  }, [members, sortKey, statusFilter]);

  const totalCount = grouped.reduce((s, g) => s + g.members.length, 0);

  return (
    <>
    {showInvite && (
      <InviteModal
        org={org}
        parts={parts}
        onClose={() => setShowInvite(false)}
        onSuccess={() => { setShowInvite(false); setShowInviteSuccess(true); }}
      />
    )}
    {showInviteSuccess && (
      <InviteSuccessModal onClose={() => setShowInviteSuccess(false)} />
    )}
    <div className="flex flex-col h-full overflow-auto">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-800">メンバー</h1>
          {!loading && <span className="text-sm text-gray-400">{totalCount}名</span>}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={14} />
            メンバーを招待
          </button>
        )}
      </header>

      {/* コントロールバー */}
      <div className="flex flex-wrap items-center gap-y-2 justify-between px-4 sm:px-8 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex gap-1">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={[
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === value
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-100",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <div className="hidden sm:flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("card")}
              className={`p-1.5 transition-colors ${viewMode === "card" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-50"}`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-50"}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 px-4 sm:px-8 py-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users size={40} className="mb-3 opacity-40" />
            <p className="text-sm">該当するメンバーがいません</p>
          </div>
        )}

        {!loading && !error && grouped.map(({ partId, partName, members: partMembers }) => (
          <MemberPartSection
            key={partId}
            partId={partId}
            partName={partName}
            members={partMembers}
            viewMode={effectiveViewMode}
            org={org}
          />
        ))}
      </main>
    </div>
    </>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      }
    >
      <MembersContent />
    </Suspense>
  );
}
