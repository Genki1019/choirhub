export type MemberStatus = "active" | "offstage";

export const MEMBER_STATUS_OPTIONS: { value: MemberStatus; label: string }[] = [
  { value: "active",   label: "在団" },
  { value: "offstage", label: "休団" },
];

export interface PartSummary {
  id: string;
  name: string;
  voiceType: string;
  sortOrder: number;
}

export interface MemberProfile {
  id: string;
  nameJa: string;
  nameKana: string | null;
  nameEn: string | null;
  avatarUrl: string | null;
  part: { id: string; name: string; voiceType: string; sortOrder: number } | null;
  memberType: { id: string; name: string; defaultFeeAmount: number | null } | null;
  roles: string[];
  status: MemberStatus;
  bio: string | null;
  job: string | null;
  interests: string | null;
  originGroup: string | null;
  joinedAt: string | null;
  // member+ のみ返却
  email?: string | null;
  phone?: string | null;
  // admin のみ返却
  adminMemo?: string | null;
}

export interface InviteResult {
  inviteToken: string;
  expiresAt: string;
}
