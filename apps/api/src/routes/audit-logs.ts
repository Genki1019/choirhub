import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin } from "../services/access.js";
import { isValidCronSecret } from "../lib/cron.js";
import { toJstDateTimeString } from "../lib/date.js";
import { toCsv, csvResponse, csvFilename } from "../lib/csv.js";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_CATEGORIES,
  auditRetentionCutoff,
  memberActor,
  recordAudit,
  type AuditAction,
  type AuditCategory,
} from "../services/audit.js";
import type { AuditLog, Prisma } from "../generated/prisma/index.js";
import type { TenantEnv } from "../middleware/tenant.js";

const PER_PAGE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const filterSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  actorId: z.string().cuid().optional(),
  actorType: z.enum(["system_admin"]).optional(),
  category: z.enum(Object.keys(AUDIT_CATEGORIES) as [AuditCategory, ...AuditCategory[]]).optional(),
});

type AuditLogFilter = z.infer<typeof filterSchema>;

function buildWhere(orgId: string, filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  return {
    orgId,
    ...(filter.actorId && { actorMemberId: filter.actorId }),
    ...(filter.actorType && { actorType: filter.actorType }),
    ...(filter.category && { action: { in: [...AUDIT_CATEGORIES[filter.category]] } }),
    ...((filter.from || filter.to) && {
      createdAt: {
        ...(filter.from && { gte: new Date(`${filter.from}T00:00:00+09:00`) }),
        ...(filter.to && {
          lt: new Date(new Date(`${filter.to}T00:00:00+09:00`).getTime() + DAY_MS),
        }),
      },
    }),
  };
}

function categoryOf(action: string): AuditCategory | null {
  const entry = Object.entries(AUDIT_CATEGORIES).find(([, actions]) =>
    (actions as readonly string[]).includes(action),
  );
  return entry ? (entry[0] as AuditCategory) : null;
}

function formatAuditLog(log: AuditLog) {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    actorType: log.actorType,
    actorMemberId: log.actorMemberId,
    actorName: log.actorName,
    action: log.action,
    category: categoryOf(log.action),
    targetType: log.targetType,
    targetId: log.targetId,
    targetLabel: log.targetLabel,
    changes: log.changes,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
  };
}

function validationError(c: Context) {
  return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
}

export const auditLogsRouter = new Hono<TenantEnv>()

  // ── GET /settings/audit-logs ── 操作履歴一覧（admin のみ）
  .get(
    "/settings/audit-logs",
    zValidator(
      "query",
      filterSchema.extend({ page: z.coerce.number().int().min(1).default(1) }),
      (result, c) => {
        if (!result.success) return validationError(c);
      },
    ),
    async (c) => {
      const org = c.get("org");
      if (!isAdmin(c.get("member"))) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { page, ...filter } = c.req.valid("query");
      const where = buildWhere(org.id, filter);
      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PER_PAGE,
          take: PER_PAGE,
        }),
      ]);

      return c.json({ data: logs.map(formatAuditLog), meta: { total, page, perPage: PER_PAGE } });
    },
  )

  // ── GET /settings/audit-logs/actors ── 操作者フィルタの選択肢（記録に登場する団員）
  .get("/settings/audit-logs/actors", async (c) => {
    const org = c.get("org");
    if (!isAdmin(c.get("member"))) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    // 団員は氏名変更があっても1件にまとめて最新の記録時点の氏名を使い、システム管理者は1件にまとめて末尾に置く
    const groups = await prisma.auditLog.groupBy({
      by: ["actorType", "actorMemberId", "actorName"],
      where: { orgId: org.id },
      _max: { createdAt: true },
    });
    const latest = new Map<string, { name: string; at: number }>();
    for (const g of groups) {
      if (!g.actorMemberId) continue;
      const at = g._max.createdAt?.getTime() ?? 0;
      const current = latest.get(g.actorMemberId);
      if (!current || at > current.at) latest.set(g.actorMemberId, { name: g.actorName, at });
    }
    const members = [...latest]
      .map(([memberId, { name }]) => ({ type: "member" as const, memberId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    const hasSystemAdmin = groups.some((g) => g.actorType === "system_admin");

    return c.json({
      data: [
        ...members,
        ...(hasSystemAdmin ? [{ type: "system_admin" as const, name: "システム管理者" }] : []),
      ],
    });
  })

  // ── GET /settings/audit-logs/export ── 操作履歴CSV（admin のみ）
  .get(
    "/settings/audit-logs/export",
    zValidator("query", filterSchema, (result, c) => {
      if (!result.success) return validationError(c);
    }),
    async (c) => {
      const org = c.get("org");
      if (!isAdmin(c.get("member"))) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const logs = await prisma.auditLog.findMany({
        where: buildWhere(org.id, c.req.valid("query")),
        orderBy: { createdAt: "desc" },
      });

      const csv = toCsv(
        ["日時", "操作者", "操作", "対象", "変更内容", "IPアドレス", "User-Agent"],
        logs.map((log) => [
          toJstDateTimeString(log.createdAt),
          log.actorName,
          AUDIT_ACTION_LABEL[log.action as AuditAction] ?? log.action,
          log.targetLabel,
          log.changes ? JSON.stringify(log.changes) : null,
          log.ipAddress,
          log.userAgent,
        ]),
      );
      await recordAudit(prisma, org.id, memberActor(c), {
        action: "audit_logs.exported",
        targetType: "audit_logs",
        targetLabel: `操作履歴（${logs.length}件）`,
      });
      return csvResponse(c, csvFilename("audit_logs"), csv);
    },
  );

// 保存期間（2年）を過ぎた監査ログを削除する
export async function handleAuditLogsCleanupCron(c: Context): Promise<Response> {
  if (!isValidCronSecret(c)) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "許可されていません" } }, 401);
  }

  const cutoff = auditRetentionCutoff(new Date());
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  return c.json({ data: { deletedCount: count } });
}
