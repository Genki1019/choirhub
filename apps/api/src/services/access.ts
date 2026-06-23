import type { Member } from "../generated/prisma/index.js";

type Role = "admin" | "tech" | "conductor" | "score" | "ticket" | "finance" | "member" | "guest" | "visitor";

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

export function isFinancePlus(member: Member): boolean {
  return isAdmin(member) || member.roles.includes("finance");
}

export function isTicketManager(member: Member): boolean {
  return isAdmin(member) || member.roles.includes("ticket");
}

// Prisma の where 句で guest/visitor メンバーを除外するフィルタ
export const EXCLUDE_HIDDEN_ROLES = {
  NOT: { roles: { hasSome: ["guest", "visitor"] as string[] } },
} as const;
