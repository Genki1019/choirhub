"use client";

import Link from "next/link";
import Image from "next/image";
import type { MemberProfile, MemberStatus } from "@/lib/api-types";

const STATUS_LABEL: Record<MemberStatus, { label: string; dot: string }> = {
  active:    { label: "在団",   dot: "bg-teal-400" },
  offstage:  { label: "休団",   dot: "bg-yellow-400" },
  alumni:    { label: "OB",     dot: "bg-blue-400" },
  suspended: { label: "停止",   dot: "bg-red-400" },
};

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin: { label: "管理者", className: "bg-gray-800 text-white" },
  tech:  { label: "技術系", className: "bg-blue-100 text-blue-700" },
  score: { label: "楽譜",   className: "bg-teal-100 text-teal-700" },
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-teal-500",
  "bg-orange-500", "bg-pink-500", "bg-indigo-500",
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
      className="flex sm:flex-col items-center sm:items-center gap-4 sm:gap-0 bg-white rounded-xl border border-gray-200 px-4 py-3 sm:py-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      {/* アバター: モバイルは小さめ、sm以上は大きく */}
      <div className="shrink-0">
        {member.avatarUrl ? (
          <Image
            src={member.avatarUrl}
            alt="avatar"
            width={80}
            height={80}
            className="w-12 h-12 sm:w-20 sm:h-20 rounded-full object-cover"
          />
        ) : (
          <div className={`w-12 h-12 sm:w-20 sm:h-20 rounded-full ${avatarColor(member.id)} flex items-center justify-center text-white text-xl sm:text-3xl font-bold`}>
            {member.nameJa.charAt(0)}
          </div>
        )}
      </div>

      {/* テキスト: モバイルは左寄せ横展開、sm以上は中央寄せ */}
      <div className="flex-1 sm:flex-none sm:flex sm:flex-col sm:items-center min-w-0 sm:w-full">
        <p className="font-semibold text-gray-800 text-sm sm:text-center sm:mt-2 truncate sm:truncate-none">{member.nameJa}</p>
        {member.nameKana && (
          <p className="text-xs text-gray-400 mt-0.5 sm:text-center">{member.nameKana}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
          <span className="text-xs text-gray-400">{st.label}</span>
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 sm:justify-center">
            {badges.map((r) => {
              const b = ROLE_BADGE[r];
              if (!b) return null;
              return (
                <span key={r} className={`text-xs px-1.5 py-0.5 rounded font-medium ${b.className}`}>
                  {b.label}
                </span>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1">{years}年在籍</p>
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
      className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
    >
      <div
        className={`w-9 h-9 rounded-full ${avatarColor(member.id)} flex items-center justify-center text-white text-sm font-bold shrink-0`}
      >
        {member.nameJa.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{member.nameJa}</p>
        <p className="text-xs text-gray-400">{member.part?.name ?? "パート未設定"}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {badges.map((r) => {
          const b = ROLE_BADGE[r];
          if (!b) return null;
          return (
            <span key={r} className={`text-xs px-1.5 py-0.5 rounded font-medium ${b.className}`}>
              {b.label}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 w-16 shrink-0">
        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
        <span className="text-xs text-gray-500">{st.label}</span>
      </div>
      <p className="text-xs text-gray-400 w-28 text-right shrink-0">{formatJoined(member.joinedAt)}入団</p>
    </Link>
  );
}
