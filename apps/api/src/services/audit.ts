import type { Context } from "hono";
import type { Prisma } from "../generated/prisma/index.js";
import { getClientIp } from "../lib/request.js";
import { toDateString } from "../lib/date.js";
import { isProtectedOrg } from "./org-deletion.js";
import type { AuthEnv } from "../middleware/auth.js";
import type { TenantEnv } from "../middleware/tenant.js";

export const AUDIT_RETENTION_YEARS = 2;

// うるう年をまたいでも保存期間が短くならないよう、日数ではなく暦の年で遡る
export function auditRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - AUDIT_RETENTION_YEARS);
  return cutoff;
}

export const AUDIT_CATEGORIES = {
  access: [
    "member.invited",
    "member.roles_changed",
    "member.status_changed",
    "member.email_changed",
    "member.removed",
  ],
  org: ["org.renamed", "org.deleted", "org.restored", "org.visitor_webhook_regenerated"],
  export: [
    "members.exported",
    "expenses.exported",
    "collections.exported",
    "payments.exported",
    "ticket_sales.exported",
    "audit_logs.exported",
  ],
  finance: [
    "expense.created",
    "expense.updated",
    "expense.deleted",
    "collection.created",
    "collection.updated",
    "collection.deleted",
    "payment.changed",
  ],
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export type AuditAction = (typeof AUDIT_CATEGORIES)[AuditCategory][number];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "member.invited": "メンバー招待",
  "member.roles_changed": "ロール変更",
  "member.status_changed": "在団状態変更",
  "member.email_changed": "メールアドレス変更",
  "member.removed": "退団処理",
  "org.renamed": "団体名変更",
  "org.deleted": "団体削除",
  "org.restored": "団体復元",
  "org.visitor_webhook_regenerated": "見学申込URL再発行",
  "members.exported": "名簿CSV出力",
  "expenses.exported": "支出CSV出力",
  "collections.exported": "徴収CSV出力",
  "payments.exported": "支払い記録CSV出力",
  "ticket_sales.exported": "チケット販売実績CSV出力",
  "audit_logs.exported": "操作履歴CSV出力",
  "expense.created": "支出登録",
  "expense.updated": "支出編集",
  "expense.deleted": "支出削除",
  "collection.created": "徴収作成",
  "collection.updated": "徴収編集",
  "collection.deleted": "徴収削除",
  "payment.changed": "支払い記録変更",
};

export type AuditActor = {
  actorType: "member" | "system_admin" | "system";
  actorMemberId: string | null;
  actorName: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type AuditValue = Prisma.InputJsonValue | null;
export type AuditChanges = Record<string, { before: AuditValue; after: AuditValue }>;

export type AuditEntry = {
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  targetLabel: string;
  changes?: AuditChanges | null;
};

function requestInfo(c: Context): Pick<AuditActor, "ipAddress" | "userAgent"> {
  return { ipAddress: getClientIp(c), userAgent: c.req.header("user-agent") ?? null };
}

// 公開デモ団体は誰でも管理者として操作履歴を閲覧できるため、他の閲覧者のIPアドレス等を記録しない
export function memberActor(c: Context<TenantEnv>): AuditActor {
  return {
    actorType: "member",
    actorMemberId: c.get("member").id,
    actorName: c.get("user").nameJa,
    ...(isProtectedOrg(c.get("org").slug) ? { ipAddress: null, userAgent: null } : requestInfo(c)),
  };
}

export function systemAdminActor(c: Context<AuthEnv>): AuditActor {
  return {
    actorType: "system_admin",
    actorMemberId: null,
    actorName: `${c.get("user").nameJa}（システム管理者）`,
    ...requestInfo(c),
  };
}

function toAuditValue(value: unknown): AuditValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return toDateString(value);
  return value as Prisma.InputJsonValue;
}

function isSame(a: AuditValue, b: AuditValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// 指定フィールドのうち値が変わったものだけを抽出する。変更がなければ null
export function diffChanges<T extends object>(
  before: T | null,
  after: T | null,
  keys: readonly (keyof T & string)[],
): AuditChanges | null {
  const changes: AuditChanges = {};
  for (const key of keys) {
    const b = toAuditValue(before?.[key]);
    const a = toAuditValue(after?.[key]);
    if (!isSame(b, a)) changes[key] = { before: b, after: a };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

// 一括操作の差分を1件にまとめる。変更前の値は重複を除いて並べ、1種類ならその値にする
export function mergeChanges(diffs: AuditChanges[]): AuditChanges | null {
  const merged: Record<string, { befores: AuditValue[]; after: AuditValue }> = {};
  for (const diff of diffs) {
    for (const [field, { before, after }] of Object.entries(diff)) {
      const entry = (merged[field] ??= { befores: [], after });
      if (!entry.befores.some((b) => isSame(b, before))) entry.befores.push(before);
    }
  }
  const fields = Object.entries(merged);
  if (fields.length === 0) return null;
  return Object.fromEntries(
    fields.map(([field, { befores, after }]) => [
      field,
      { before: befores.length === 1 ? befores[0] : (befores as Prisma.InputJsonValue), after },
    ]),
  );
}

// 本体の操作と同じトランザクションで書き込むため、PrismaClient/TransactionClient のどちらも受け付ける
export function recordAudit(
  db: Pick<Prisma.TransactionClient, "auditLog">,
  orgId: string,
  actor: AuditActor,
  entry: AuditEntry,
) {
  return db.auditLog.create({
    data: {
      orgId,
      ...actor,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel,
      changes: entry.changes ?? undefined,
    },
  });
}
