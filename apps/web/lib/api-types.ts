export type MemberStatus = "active" | "offstage" | "alumni" | "suspended";

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
