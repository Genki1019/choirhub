import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isMemberPlus } from "../services/access.js";
import { sendBulkMail } from "../services/mail.js";
import { logger } from "../lib/logger.js";
import type { TenantEnv } from "../middleware/tenant.js";
import type {
  Organization,
  VisitorApplication,
  VisitorApplicationStatus,
} from "../generated/prisma/index.js";

const applicationInclude = {
  createdBy: { select: { id: true, userRef: { select: { nameJa: true } } } },
  reviewedBy: { select: { id: true, userRef: { select: { nameJa: true } } } },
} as const;

type ApplicationWithRelations = VisitorApplication & {
  createdBy: { id: string; userRef: { nameJa: string } } | null;
  reviewedBy: { id: string; userRef: { nameJa: string } } | null;
};

function formatApplication(a: ApplicationWithRelations | VisitorApplication) {
  const withRelations = a as ApplicationWithRelations;
  return {
    id: a.id,
    name: a.name,
    partHope: a.partHope,
    originGroup: a.originGroup,
    contact: a.contact,
    message: a.message,
    source: a.source,
    status: a.status,
    createdByName: withRelations.createdBy?.userRef.nameJa ?? null,
    reviewedByName: withRelations.reviewedBy?.userRef.nameJa ?? null,
    reviewedAt: a.reviewedAt,
    createdAt: a.createdAt,
  };
}

function buildIntroDraft(
  applications: Pick<VisitorApplication, "name" | "partHope" | "originGroup">[],
): { subject: string; body: string } {
  const lines = applications.map((a) => {
    const details = [
      a.partHope ? `希望パート: ${a.partHope}` : null,
      a.originGroup ? `出身団体: ${a.originGroup}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
    return details ? `・${a.name}さん（${details}）` : `・${a.name}さん`;
  });

  return {
    subject: "見学者のご紹介",
    body: `以下の方が見学にいらっしゃいます。\n\n${lines.join("\n")}`,
  };
}

async function notifyAdmins(org: Organization, application: VisitorApplication): Promise<void> {
  const admins = await prisma.member.findMany({
    where: { orgId: org.id, roles: { has: "admin" }, deletedAt: null },
    include: { userRef: { select: { email: true } } },
  });
  if (admins.length === 0) return;

  const details = [
    application.partHope ? `希望パート: ${application.partHope}` : null,
    application.originGroup ? `出身団体: ${application.originGroup}` : null,
    application.contact ? `連絡先: ${application.contact}` : null,
    application.message ? `コメント: ${application.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendBulkMail({
      to: admins.map((m) => ({ email: m.userRef.email })),
      subject: "【ChoirHub】見学申込がありました",
      body: `見学申込がありました。\n\n氏名: ${application.name}\n${details}\n\n「メンバー」→「見学申込」から確認・承認してください。`,
      orgName: org.name,
    });
  } catch (err) {
    logger.error("[visitor-applications] 通知メール送信失敗:", err);
  }
}

const createApplicationSchema = z.object({
  name: z.string().min(1),
  partHope: z.string().optional(),
  originGroup: z.string().optional(),
  contact: z.string().optional(),
  message: z.string().optional(),
});

export const visitorApplicationsRouter = new Hono<TenantEnv>()

  // ── POST /visitor-applications ──
  .post(
    "/visitor-applications",
    zValidator("json", createApplicationSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isMemberPlus(actingMember)) {
        return c.json(
          { error: { code: "FORBIDDEN", message: "見学申込の登録は一般団員以上のみ可能です" } },
          403,
        );
      }

      const body = c.req.valid("json");

      const application = await prisma.visitorApplication.create({
        data: {
          orgId: org.id,
          name: body.name,
          partHope: body.partHope,
          originGroup: body.originGroup,
          contact: body.contact,
          message: body.message,
          source: "manual",
          createdById: actingMember.id,
        },
      });

      await notifyAdmins(org, application);

      return c.json({ data: formatApplication(application) }, 201);
    },
  )

  // ── GET /visitor-applications ──
  .get("/visitor-applications", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const { status } = c.req.query();

    const applications = await prisma.visitorApplication.findMany({
      where: {
        orgId: org.id,
        ...(status ? { status: status as VisitorApplicationStatus } : {}),
      },
      include: applicationInclude,
      orderBy: { createdAt: "desc" },
    });

    return c.json({ data: applications.map(formatApplication) });
  })

  // ── POST /visitor-applications/:id/approve ──
  .post("/visitor-applications/:id/approve", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const application = await prisma.visitorApplication.findFirst({
      where: { id, orgId: org.id },
    });
    if (!application) {
      return c.json({ error: { code: "NOT_FOUND", message: "見学申込が見つかりません" } }, 404);
    }
    if (application.status !== "pending") {
      return c.json({ error: { code: "CONFLICT", message: "既に処理済みの申込です" } }, 409);
    }

    const updated = await prisma.visitorApplication.update({
      where: { id },
      data: { status: "approved", reviewedById: actingMember.id, reviewedAt: new Date() },
    });

    return c.json({
      data: { application: formatApplication(updated), draft: buildIntroDraft([updated]) },
    });
  })

  // ── POST /visitor-applications/:id/reject ──
  .post("/visitor-applications/:id/reject", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const application = await prisma.visitorApplication.findFirst({
      where: { id, orgId: org.id },
    });
    if (!application) {
      return c.json({ error: { code: "NOT_FOUND", message: "見学申込が見つかりません" } }, 404);
    }
    if (application.status !== "pending") {
      return c.json({ error: { code: "CONFLICT", message: "既に処理済みの申込です" } }, 409);
    }

    const updated = await prisma.visitorApplication.update({
      where: { id },
      data: { status: "rejected", reviewedById: actingMember.id, reviewedAt: new Date() },
    });

    return c.json({ data: formatApplication(updated) });
  })

  // ── POST /visitor-applications/bulk-approve ──
  .post(
    "/visitor-applications/bulk-approve",
    zValidator("json", z.object({ ids: z.array(z.string()).min(1) }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { ids } = c.req.valid("json");

      const applications = await prisma.visitorApplication.findMany({
        where: { id: { in: ids }, orgId: org.id, status: "pending" },
      });
      if (applications.length === 0) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "承認可能な見学申込が見つかりません" } },
          404,
        );
      }

      const reviewedAt = new Date();
      await prisma.visitorApplication.updateMany({
        where: { id: { in: applications.map((a) => a.id) } },
        data: { status: "approved", reviewedById: actingMember.id, reviewedAt },
      });

      const updatedApplications = applications.map((a) => ({
        ...a,
        status: "approved" as const,
        reviewedById: actingMember.id,
        reviewedAt,
      }));

      return c.json({
        data: {
          applications: updatedApplications.map(formatApplication),
          draft: buildIntroDraft(updatedApplications),
        },
      });
    },
  );

// ────────────────────────────
// 公開Webhook（Googleフォーム連携、認証不要）
// ────────────────────────────

const publicApplicationSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  partHope: z.string().optional(),
  originGroup: z.string().optional(),
  contact: z.string().optional(),
  message: z.string().optional(),
});

export async function handlePublicVisitorApplication(c: Context): Promise<Response> {
  const json = await c.req.json().catch(() => null);
  const parsed = publicApplicationSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
  }
  const { token, ...body } = parsed.data;

  const org = await prisma.organization.findUnique({ where: { visitorFormToken: token } });
  if (!org) {
    return c.json({ error: { code: "NOT_FOUND", message: "無効なトークンです" } }, 404);
  }

  const application = await prisma.visitorApplication.create({
    data: { orgId: org.id, ...body, source: "google_form" },
  });

  await notifyAdmins(org, application);

  return c.json({ data: formatApplication(application) }, 201);
}
