import { Hono, type Context } from "hono";
import { prisma } from "../lib/prisma.js";
import { isAdmin } from "../services/access.js";
import { logger } from "../lib/logger.js";
import type { TenantEnv } from "../middleware/tenant.js";

const ATTENDANCE_DUE_THRESHOLD_DAYS = 3;

export const notificationsRouter = new Hono<TenantEnv>()

  // ── GET /notifications ── 通知一覧
  .get("/notifications", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    const pageRaw = c.req.query("page");
    const perPageRaw = c.req.query("perPage");
    if (
      (pageRaw !== undefined && !/^\d+$/.test(pageRaw)) ||
      (perPageRaw !== undefined && !/^\d+$/.test(perPageRaw))
    ) {
      return c.json(
        {
          error: { code: "VALIDATION_ERROR", message: "page・perPageは正の整数で指定してください" },
        },
        400,
      );
    }
    const page = Math.max(1, Number(pageRaw ?? 1));
    const perPage = Math.min(50, Math.max(1, Number(perPageRaw ?? 20)));

    const where = { orgId: org.id, memberId: member.id };

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return c.json(
      {
        data: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        })),
        meta: { total, page, perPage, unreadCount },
      },
      200,
      { "Cache-Control": "no-store" },
    );
  })

  // ── PATCH /notifications/read-all ── 全件既読化
  .patch("/notifications/read-all", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    await prisma.notification.updateMany({
      where: { orgId: org.id, memberId: member.id, readAt: null },
      data: { readAt: new Date() },
    });

    return c.body(null, 204);
  })

  // ── PATCH /notifications/:id/read ── 既読化
  .patch("/notifications/:id/read", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { id } = c.req.param();

    const notification = await prisma.notification.findFirst({ where: { id, orgId: org.id } });
    if (!notification || notification.memberId !== member.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "通知が見つかりません" } }, 404);
    }

    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return c.body(null, 204);
  });

// ────────────────────────────
// 通知作成ヘルパー（他ルートから呼び出す）
// ────────────────────────────

// メールアドレス変更完了通知。1ユーザーが複数団体に所属する場合は全所属分にそれぞれ作成する
export async function notifyEmailChanged(userId: string): Promise<void> {
  try {
    const memberships = await prisma.member.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, orgId: true },
    });
    if (memberships.length === 0) return;

    await prisma.notification.createMany({
      data: memberships.map((m) => ({
        orgId: m.orgId,
        memberId: m.id,
        type: "email_changed",
        title: "メールアドレスが変更されました",
        link: `/members/${m.id}`,
      })),
    });
  } catch (err) {
    logger.error("[notifications] email_changed 通知作成失敗:", err);
  }
}

// ────────────────────────────
// 内部cron専用エンドポイント（認証ミドルウェアを通さない。CRON_SECRETで検証）
// ────────────────────────────

export async function handleAttendanceDueCron(c: Context): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = c.req.header("Authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "許可されていません" } }, 401);
  }

  const now = new Date();
  const threshold = new Date(now.getTime() + ATTENDANCE_DUE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: { deadline: { gte: now, lte: threshold } },
    include: { attendances: { select: { memberId: true, status: true } } },
  });

  let createdCount = 0;

  for (const event of events) {
    const members = await prisma.member.findMany({
      where: { orgId: event.orgId, status: "active", deletedAt: null },
    });

    const answeredMemberIds = new Set(
      event.attendances.filter((a) => a.status !== "undecided").map((a) => a.memberId),
    );

    const targets = members.filter((m) => {
      if (answeredMemberIds.has(m.id)) return false;
      if (isAdmin(m)) return true;
      const roleOk =
        event.targetRoles.length === 0 || event.targetRoles.some((r) => m.roles.includes(r));
      const partOk =
        event.targetPartIds.length === 0 ||
        (m.partId !== null && event.targetPartIds.includes(m.partId));
      return roleOk && partOk;
    });
    if (targets.length === 0) continue;

    const link = `/schedule/${event.id}`;
    const existing = await prisma.notification.findMany({
      where: { type: "attendance_due", link, memberId: { in: targets.map((m) => m.id) } },
      select: { memberId: true },
    });
    const alreadyNotified = new Set(existing.map((n) => n.memberId));
    const toCreate = targets.filter((m) => !alreadyNotified.has(m.id));
    if (toCreate.length === 0) continue;

    await prisma.notification.createMany({
      data: toCreate.map((m) => ({
        orgId: event.orgId,
        memberId: m.id,
        type: "attendance_due",
        title: `「${event.title}」の出欠回答期限が近づいています`,
        link,
      })),
    });
    createdCount += toCreate.length;
  }

  return c.json({ data: { createdCount } });
}
