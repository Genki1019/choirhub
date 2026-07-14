"use client";

import Link from "next/link";
import Image from "next/image";
import type { MemberProfile, MemberStatus } from "@/lib/api-types";

const STATUS_LABEL: Record<MemberStatus, { label: string; dot: string }> = {
  active: { label: "在団", dot: "bg-teal-400" },
  offstage: { label: "休団", dot: "bg-yellow-400" },
};

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin: { label: "管理者", className: "bg-gray-800 text-white" },
  tech: { label: "技術系", className: "bg-brand-100 text-brand-700" },
  score: { label: "楽譜", className: "bg-teal-100 text-teal-700" },
};

const AVATAR_COLORS = [
  "bg-brand-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-sky-500",
];

export function avatarColor(id: string): string {
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function membershipYears(joinedAt: string | null): number {
  if (!joinedAt) return 0;
  const ms = Date.now() - new Date(joinedAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365));
}

function formatJoined(joinedAt: string | null): string {
  if (!joinedAt) return "不明";
  const d = new Date(joinedAt);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function MemberCard({ member, org }: { member: MemberProfile; org: string }) {
  const st = STATUS_LABEL[member.status];
  const years = membershipYears(member.joinedAt);
  const badges = member.roles.filter((r) => r !== "member");

  return (
    <Link
      href={`/${org}/members/${member.id}`}
      prefetch={false}
      className="hover:border-brand-300 flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-all hover:shadow-sm sm:flex-col sm:items-center sm:gap-0 sm:py-5"
    >
      {/* アバター: モバイルは小さめ、sm以上は大きく */}
      <div className="shrink-0">
        {member.avatarUrl ? (
          <Image
            src={member.avatarUrl}
            alt="avatar"
            width={80}
            height={80}
            unoptimized
            className="h-12 w-12 rounded-full object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <div
            className={`h-12 w-12 rounded-full sm:h-20 sm:w-20 ${avatarColor(member.id)} flex items-center justify-center text-xl font-bold text-white sm:text-3xl`}
          >
            {member.nameJa.charAt(0)}
          </div>
        )}
      </div>

      {/* テキスト: モバイルは左寄せ横展開、sm以上は中央寄せ */}
      <div className="min-w-0 flex-1 sm:flex sm:w-full sm:flex-none sm:flex-col sm:items-center">
        <p className="sm:truncate-none truncate text-sm font-semibold text-gray-800 sm:mt-2 sm:text-center">
          {member.nameJa}
        </p>
        {member.nameKana && (
          <p className="mt-0.5 text-xs text-gray-400 sm:text-center">{member.nameKana}</p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
          <span className="text-xs text-gray-400">{st.label}</span>
        </div>
        {badges.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 sm:justify-center">
            {badges.map((r) => {
              const b = ROLE_BADGE[r];
              if (!b) return null;
              return (
                <span
                  key={r}
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${b.className}`}
                >
                  {b.label}
                </span>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">{years}年在籍</p>
      </div>
    </Link>
  );
}

export function MemberRow({ member, org }: { member: MemberProfile; org: string }) {
  const st = STATUS_LABEL[member.status];
  const badges = member.roles.filter((r) => r !== "member");

  return (
    <Link
      href={`/${org}/members/${member.id}`}
      prefetch={false}
      className="flex items-center gap-4 border-b border-gray-100 px-5 py-3 transition-colors last:border-0 hover:bg-gray-50"
    >
      <div
        className={`h-9 w-9 rounded-full ${avatarColor(member.id)} flex shrink-0 items-center justify-center text-sm font-bold text-white`}
      >
        {member.nameJa.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">{member.nameJa}</p>
        <p className="text-xs text-gray-400">{member.part?.name ?? "パート未設定"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {badges.map((r) => {
          const b = ROLE_BADGE[r];
          if (!b) return null;
          return (
            <span key={r} className={`rounded px-1.5 py-0.5 text-xs font-medium ${b.className}`}>
              {b.label}
            </span>
          );
        })}
      </div>
      <div className="flex w-16 shrink-0 items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
        <span className="text-xs text-gray-500">{st.label}</span>
      </div>
      <p className="w-28 shrink-0 text-right text-xs text-gray-400">
        {formatJoined(member.joinedAt)}入団
      </p>
    </Link>
  );
}
