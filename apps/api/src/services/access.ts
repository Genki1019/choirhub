import type { Member } from "../generated/prisma/index.js";

type Role =
  "admin" | "tech" | "conductor" | "score" | "ticket" | "finance" | "member" | "guest" | "visitor";

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  tech: 60,
  conductor: 60,
  score: 60,
  ticket: 40,
  finance: 40,
  member: 40,
  guest: 20,
  visitor: 10,
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "最高管理者",
  tech: "技術系",
  conductor: "指揮者",
  score: "楽譜がかり",
  ticket: "チケット担当",
  finance: "会計",
  member: "一般",
  guest: "客演",
  visitor: "体験",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as Role] ?? role;
}

export function hasRole(member: Member, ...required: Role[]): boolean {
  return required.some((role) => {
    if (role === "admin") return member.roles.includes("admin");
    return member.roles.some((r) => ROLE_HIERARCHY[r as Role] >= ROLE_HIERARCHY[role]);
  });
}

export function isAdmin(member: Member): boolean {
  return hasRole(member, "admin");
}

export function isMemberPlus(member: Member): boolean {
  return hasRole(member, "member");
}

export function canAccessMemberSensitiveData(member: Member): boolean {
  return isAdmin(member);
}

// guest / visitor のみのアカウント（member 以上のロールを持たない）
export function isHiddenRole(member: Member): boolean {
  const maxLevel = Math.max(...member.roles.map((r) => ROLE_HIERARCHY[r as Role] ?? 0));
  return maxLevel < ROLE_HIERARCHY["member"];
}

export function isVisitor(member: Member): boolean {
  return member.roles.includes("visitor") && !isMemberPlus(member);
}

// 全所属がvisitor判定の場合のみtrue（所属0件は対象外＝通常セッション扱い）。
// visitorは共有アカウントという前提のため、通常はどのユーザーも複数団体に跨らない想定。
export function isVisitorOnlyAccount(memberships: Member[]): boolean {
  return memberships.length > 0 && memberships.every((m) => isVisitor(m));
}

export function isFinancePlus(member: Member): boolean {
  return isAdmin(member) || member.roles.includes("finance");
}

// オンステ調査・フォーメーション・予定の管理。同じ階層値の score は含まない
export function isTechOrConductor(member: Member): boolean {
  return isAdmin(member) || member.roles.includes("tech") || member.roles.includes("conductor");
}

export function isTicketManager(member: Member): boolean {
  return isAdmin(member) || member.roles.includes("ticket");
}

// Prisma の where 句で guest/visitor メンバーを除外するフィルタ
export const EXCLUDE_HIDDEN_ROLES = {
  NOT: { roles: { hasSome: ["guest", "visitor"] as string[] } },
} as const;
