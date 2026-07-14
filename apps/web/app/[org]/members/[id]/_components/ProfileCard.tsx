import Image from "next/image";
import type { MemberProfile } from "@/lib/members-api";
import { ROLE_BADGE_STYLES } from "@/lib/roles";
import { avatarColor } from "../../_components/MemberCard";

const STATUS_OPTIONS = [
  { value: "active", label: "在団", dot: "bg-teal-400" },
  { value: "offstage", label: "休団", dot: "bg-yellow-400" },
];

function membershipYears(joinedAt: string | null): number {
  if (!joinedAt) return 0;
  const ms = Date.now() - new Date(joinedAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365));
}

interface ProfileCardProps {
  member: MemberProfile;
}

export function ProfileCard({ member }: ProfileCardProps) {
  const status = STATUS_OPTIONS.find((s) => s.value === member.status)!;
  const badges = member.roles.filter((r) => r !== "member" && r !== "guest" && r !== "visitor");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          {member.avatarUrl ? (
            <Image
              src={member.avatarUrl}
              alt="avatar"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div
              className={`h-20 w-20 rounded-full ${avatarColor(member.id)} flex items-center justify-center text-3xl font-bold text-white`}
            >
              {member.nameJa.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-xl font-bold text-gray-800">{member.nameJa}</h2>
          {member.nameKana && <p className="mt-0.5 text-sm text-gray-400">{member.nameKana}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">{member.part?.name ?? "パート未設定"}</span>
            <span className="text-gray-300">|</span>
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            <span className="text-sm text-gray-600">{status.label}</span>
            <span className="text-xs text-gray-400">{membershipYears(member.joinedAt)}年在籍</span>
          </div>
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((r) => {
                const b = ROLE_BADGE_STYLES[r];
                if (!b) return null;
                return (
                  <span
                    key={r}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.className}`}
                  >
                    {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {member.bio && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-sm leading-relaxed text-gray-600">{member.bio}</p>
        </div>
      )}
    </div>
  );
}
