import { Hono, type Context } from "hono";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";
import { requireSystemAdmin } from "../middleware/system-admin.js";
import { isValidCronSecret } from "../lib/cron.js";
import { getPurgeScheduledAt, purgeExpiredOrgs } from "../services/org-deletion.js";
// authMiddleware/requireSystemAdmin を各ルートに個別指定する理由は org-applications.ts の adminRouter を参照
export const deletedOrgsRouter = new Hono<AuthEnv>()

  // ── GET /auth/orgs/deleted ── 論理削除済み（完全削除待ち）団体一覧
  .get("/auth/orgs/deleted", authMiddleware, requireSystemAdmin, async (c) => {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });
    return c.json({
      data: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        deletedAt: org.deletedAt,
        deletedByEmail: org.deletedByEmail,
        purgeScheduledAt: getPurgeScheduledAt(org.deletedAt!),
      })),
    });
  })

  // ── POST /auth/orgs/:id/restore ── 論理削除済み団体の復元
  .post("/auth/orgs/:id/restore", authMiddleware, requireSystemAdmin, async (c) => {
    const { id } = c.req.param();
    const { count } = await prisma.organization.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null, deletedByEmail: null },
    });
    if (count === 0) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "削除済みの団体が見つかりません" } },
        404,
      );
    }
    const org = await prisma.organization.findUniqueOrThrow({ where: { id } });
    return c.json({ data: { id: org.id, name: org.name, slug: org.slug } });
  });

export async function handleOrgPurgeCron(c: Context): Promise<Response> {
  if (!isValidCronSecret(c)) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "許可されていません" } }, 401);
  }
  const result = await purgeExpiredOrgs();
  return c.json({ data: result });
}
