import type { ReactNode } from "react";
import type { MemberProfile } from "@/lib/members-api";

function formatJoined(joinedAt: string | null): string {
  if (!joinedAt) return "不明";
  const d = new Date(joinedAt);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center px-5 py-3 gap-3">
      <dt className="text-xs font-medium text-gray-500 w-28 shrink-0">{label}</dt>
      <dd className="flex items-center gap-1.5 text-sm text-gray-800 min-w-0">
        {icon}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}

interface ProfileInfoSectionProps {
  member: MemberProfile;
  isMemberPlus: boolean;
  isAdmin: boolean;
}

export function ProfileInfoSection({ member, isMemberPlus, isAdmin }: ProfileInfoSectionProps) {
  const hasAnyRow = member.job || member.interests || member.originGroup
    || member.joinedAt
    || (isMemberPlus && (member.email || member.phone))
    || (isAdmin && member.adminMemo);

  if (!hasAnyRow) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">プロフィール</p>
      </div>
      <dl className="divide-y divide-gray-100">
        {member.memberType && <InfoRow label="メンバー区分" value={member.memberType.name} />}
        {member.job        && <InfoRow label="職業"        value={member.job} />}
        {member.interests  && <InfoRow label="好きなもの"   value={member.interests} />}
        {member.originGroup && <InfoRow label="出身団体"    value={member.originGroup} />}
        <InfoRow label="入団日" value={`${formatJoined(member.joinedAt)}入団`} />
        {isMemberPlus && member.email && (
          <InfoRow label="メールアドレス" value={member.email} />
        )}
        {isMemberPlus && member.phone && (
          <InfoRow label="電話番号" value={member.phone} />
        )}
        {isAdmin && member.adminMemo && (
          <InfoRow label="管理者メモ" value={member.adminMemo} />
        )}
      </dl>
    </div>
  );
}
