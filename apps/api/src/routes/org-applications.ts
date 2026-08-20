import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createMiddleware } from "hono/factory";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";
import { checkOrgApplicationRateLimit } from "../lib/redis.js";
import { getClientIp } from "../lib/request.js";
import { isSystemAdmin, getSystemAdminEmails } from "../lib/systemAdmin.js";
import { PART_TEMPLATES, type PartTemplateKey } from "../lib/partTemplates.js";
import { sendOrgApplicationEmail, sendInviteEmail } from "../services/mail.js";
import { logger } from "../lib/logger.js";
import {
  Prisma,
  type OrgApplication,
  type OrgApplicationStatus,
} from "../generated/prisma/index.js";

function formatApplication(a: OrgApplication) {
  return {
    id: a.id,
    orgName: a.orgName,
    slug: a.slug,
    templateKey: a.templateKey,
    applicantName: a.applicantName,
    applicantEmail: a.applicantEmail,
    message: a.message,
    status: a.status,
    reviewedByEmail: a.reviewedByEmail,
    reviewedAt: a.reviewedAt,
    createdAt: a.createdAt,
  };
}

const requireSystemAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  if (!isSystemAdmin(c.get("user").email)) {
    return c.json({ error: { code: "FORBIDDEN", message: "システム管理者権限が必要です" } }, 403);
  }
  await next();
});

const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンのみ使用できます");

const orgFieldsSchema = {
  orgName: z.string().min(1).max(100),
  slug: slugSchema,
  templateKey: z.enum(["mixed4", "women3", "mens4", "custom"]),
  applicantName: z.string().min(1).max(100),
  applicantEmail: z.string().email(),
};

const createApplicationSchema = z.object({
  ...orgFieldsSchema,
  message: z.string().max(1000).optional(),
});
const approveApplicationSchema = z.object({ slug: slugSchema.optional() });
const directCreateSchema = z.object(orgFieldsSchema);
const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

// 団体・パート・イベント区分・招待トークンを作成し招待メールを送信する共通処理。
// 承認フロー（OrgApplication経由）とシステム管理者による作成の両方から使う。
// Organization〜InviteTokenの作成は$transactionでまとめ、途中で失敗しても
// パート・イベント区分が欠けた中途半端な団体が残らないようにする。
// スラグの一意性チェックは事前findUniqueではなくDBのunique制約＋P2002捕捉に任せることで、
// 承認の二重クリック等による競合（TOCTOU）でも常に片方だけが成功するようにする。
async function createOrgWithInvite(params: {
  orgName: string;
  slug: string;
  templateKey: PartTemplateKey;
  applicantName: string;
  applicantEmail: string;
}): Promise<{ ok: true } | { ok: false; conflict: true }> {
  const { orgName, slug, templateKey, applicantName, applicantEmail } = params;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let org: { id: string; name: string };
  let invite: { token: string };

  try {
    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug, partTemplate: { templateKey } },
      });

      await tx.eventCategory.createMany({
        data: [
          { orgId: org.id, name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 1 },
          { orgId: org.id, name: "本番", slug: "concert", color: "#EF4444", sortOrder: 2 },
          { orgId: org.id, name: "会議", slug: "meeting", color: "#F59E0B", sortOrder: 3 },
          { orgId: org.id, name: "その他", slug: "other", color: "#6B7280", sortOrder: 4 },
        ],
      });

      await tx.part.createMany({
        data: PART_TEMPLATES[templateKey].parts.map((part) => ({ ...part, orgId: org.id })),
      });

      const invite = await tx.inviteToken.create({
        data: {
          email: applicantEmail,
          nameJa: applicantName,
          orgId: org.id,
          roles: ["admin"],
          expiresAt,
        },
      });

      return { org, invite };
    });
    org = created.org;
    invite = created.invite;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, conflict: true };
    }
    throw err;
  }

  try {
    await sendInviteEmail({
      to: applicantEmail,
      nameJa: applicantName,
      orgName: org.name,
      inviteToken: invite.token,
      expiresAt,
    });
  } catch (mailErr) {
    logger.error("[org-applications] 招待メール送信失敗（招待トークンは有効）:", mailErr);
  }

  return { ok: true };
}

type PendingLookupResult =
  | { ok: true; application: OrgApplication }
  | { ok: false; response: { code: string; message: string }; status: 404 | 409 };

async function findPendingApplication(id: string): Promise<PendingLookupResult> {
  const application = await prisma.orgApplication.findUnique({ where: { id } });
  if (!application) {
    return {
      ok: false,
      response: { code: "NOT_FOUND", message: "申請が見つかりません" },
      status: 404,
    };
  }
  if (application.status !== "pending") {
    return {
      ok: false,
      response: { code: "CONFLICT", message: "既に処理済みの申請です" },
      status: 409,
    };
  }
  return { ok: true, application };
}

// 認証不要（申請の投稿のみ公開）
const publicRouter = new Hono()

  // ── POST /auth/org-applications ── 団体作成を申請する（公開・認証不要）
  .post(
    "/auth/org-applications",
    zValidator("json", createApplicationSchema, (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: r.error.issues[0]?.message ?? "入力値が不正です",
            },
          },
          400,
        );
    }),
    async (c) => {
      const ip = getClientIp(c);
      if (!(await checkOrgApplicationRateLimit(ip))) {
        return c.json(
          {
            error: {
              code: "TOO_MANY_REQUESTS",
              message: "しばらく時間をおいてから再試行してください",
            },
          },
          429,
        );
      }

      const { orgName, slug, templateKey, applicantName, applicantEmail, message } =
        c.req.valid("json");

      await prisma.orgApplication.create({
        data: { orgName, slug, templateKey, applicantName, applicantEmail, message },
      });

      const adminEmails = getSystemAdminEmails();
      if (adminEmails.length === 0) {
        logger.warn(
          "[org-applications] SYSTEM_ADMIN_EMAILS 未設定のため通知メールを送信できません",
        );
      } else {
        try {
          await sendOrgApplicationEmail({
            to: adminEmails,
            applicantName,
            applicantEmail,
            orgName,
            message,
          });
        } catch (mailErr) {
          logger.error("[org-applications] 申請通知メール送信失敗:", mailErr);
        }
      }

      return c.json({ data: { message: "送信しました" } }, 201);
    },
  );

// システム管理者のみ。authMiddleware/requireSystemAdmin は各ルートに個別指定する
// （sub-appの `.use("*", ...)` は `.route()` で親アプリに合成した際にパスが素通しになり、
// 他ルーター配下の無関係なパスにまで漏れて適用されてしまうため使わない）。
const adminRouter = new Hono<AuthEnv>()

  // ── GET /auth/org-applications ── 申請一覧（システム管理者のみ）
  .get(
    "/auth/org-applications",
    authMiddleware,
    requireSystemAdmin,
    zValidator("query", listQuerySchema, (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: r.error.issues[0]?.message ?? "入力値が不正です",
            },
          },
          400,
        );
    }),
    async (c) => {
      const { status } = c.req.valid("query");

      const applications = await prisma.orgApplication.findMany({
        where: { status: status as OrgApplicationStatus },
        orderBy: { createdAt: "desc" },
      });

      return c.json({ data: applications.map(formatApplication) });
    },
  )

  // ── POST /auth/org-applications/:id/approve ── 承認（システム管理者のみ）
  .post(
    "/auth/org-applications/:id/approve",
    authMiddleware,
    requireSystemAdmin,
    zValidator("json", approveApplicationSchema, (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: r.error.issues[0]?.message ?? "入力値が不正です",
            },
          },
          400,
        );
    }),
    async (c) => {
      const { id } = c.req.param();
      const lookup = await findPendingApplication(id);
      if (!lookup.ok) {
        return c.json({ error: lookup.response }, lookup.status);
      }

      const { slug: slugOverride } = c.req.valid("json");
      const slug = slugOverride ?? lookup.application.slug;
      const reviewedByEmail = c.get("user").email;
      const reviewedAt = new Date();

      // 承認と却下が同時に実行された場合の競合（TOCTOU）を防ぐため、団体作成に入る前に
      // pending→approved の遷移を条件付き更新（status: "pending" のときのみ成功）で排他的に確定させる
      const claimed = await prisma.orgApplication.updateMany({
        where: { id, status: "pending" },
        data: { status: "approved", reviewedByEmail, reviewedAt },
      });
      if (claimed.count === 0) {
        return c.json({ error: { code: "CONFLICT", message: "既に処理済みの申請です" } }, 409);
      }

      const result = await createOrgWithInvite({
        orgName: lookup.application.orgName,
        slug,
        templateKey: lookup.application.templateKey as PartTemplateKey,
        applicantName: lookup.application.applicantName,
        applicantEmail: lookup.application.applicantEmail,
      });
      if (!result.ok) {
        // スラグ重複で団体作成に失敗した場合は pending に戻し、別のスラグで再承認できるようにする
        await prisma.orgApplication.update({
          where: { id },
          data: { status: "pending", reviewedByEmail: null, reviewedAt: null },
        });
        return c.json(
          { error: { code: "CONFLICT", message: "このスラグはすでに使用されています" } },
          409,
        );
      }

      return c.json({
        data: formatApplication({
          ...lookup.application,
          slug,
          status: "approved",
          reviewedByEmail,
          reviewedAt,
        }),
      });
    },
  )

  // ── POST /auth/org-applications/:id/reject ── 却下（システム管理者のみ）
  .post("/auth/org-applications/:id/reject", authMiddleware, requireSystemAdmin, async (c) => {
    const { id } = c.req.param();
    const lookup = await findPendingApplication(id);
    if (!lookup.ok) {
      return c.json({ error: lookup.response }, lookup.status);
    }

    const reviewedByEmail = c.get("user").email;
    const reviewedAt = new Date();

    // 承認と却下が同時に実行された場合の競合（TOCTOU）を防ぐため条件付き更新にする
    const rejected = await prisma.orgApplication.updateMany({
      where: { id, status: "pending" },
      data: { status: "rejected", reviewedByEmail, reviewedAt },
    });
    if (rejected.count === 0) {
      return c.json({ error: { code: "CONFLICT", message: "既に処理済みの申請です" } }, 409);
    }

    return c.json({
      data: formatApplication({
        ...lookup.application,
        status: "rejected",
        reviewedByEmail,
        reviewedAt,
      }),
    });
  })

  // ── POST /auth/orgs ── 団体を作成する（申請を経由しない。システム管理者のみ）
  .post(
    "/auth/orgs",
    authMiddleware,
    requireSystemAdmin,
    zValidator("json", directCreateSchema, (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: r.error.issues[0]?.message ?? "入力値が不正です",
            },
          },
          400,
        );
    }),
    async (c) => {
      const { orgName, slug, templateKey, applicantName, applicantEmail } = c.req.valid("json");

      const result = await createOrgWithInvite({
        orgName,
        slug,
        templateKey,
        applicantName,
        applicantEmail,
      });
      if (!result.ok) {
        return c.json(
          { error: { code: "CONFLICT", message: "このスラグはすでに使用されています" } },
          409,
        );
      }

      return c.json({ data: { message: "団体を作成し、招待メールを送信しました" } }, 201);
    },
  );

export const orgApplicationsRouter = new Hono().route("/", publicRouter).route("/", adminRouter);
