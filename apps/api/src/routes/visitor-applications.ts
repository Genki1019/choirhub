import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isMemberPlus } from "../services/access.js";
import { sendBulkMail } from "../services/mail.js";
import { logger } from "../lib/logger.js";
import type { TenantEnv } from "../middleware/tenant.js";
import type {
  Member,
  Organization,
  VisitorApplication,
  VisitorApplicationStatus,
} from "../generated/prisma/index.js";

const applicationInclude = {
  createdBy: { select: { id: true, userRef: { select: { nameJa: true } } } },
  reviewedBy: { select: { id: true, userRef: { select: { nameJa: true } } } },
} as const;

type ApplicationForFormat = VisitorApplication & {
  createdBy?: { id: string; userRef: { nameJa: string } } | null;
  reviewedBy?: { id: string; userRef: { nameJa: string } } | null;
};

function formatApplication(a: ApplicationForFormat) {
  return {
    id: a.id,
    name: a.name,
    partHope: a.partHope,
    originGroup: a.originGroup,
    contact: a.contact,
    message: a.message,
    source: a.source,
    status: a.status,
    createdByName: a.createdBy?.userRef.nameJa ?? null,
    reviewedByName: a.reviewedBy?.userRef.nameJa ?? null,
    reviewedAt: a.reviewedAt,
    createdAt: a.createdAt,
  };
}

// {key} をvarsの値に置き換える。keyが未知の場合は元のまま残す。
function substituteVars(
  text: string,
  vars: Record<string, string>,
  fallback: Record<string, string> = {},
): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] || fallback[key] || "" : match,
  );
}

// `[...]` で囲んだ区間は、中で参照している変数がすべて空なら区間ごと非表示になる
// （例: `[ / 出身団体: {origin}]` は origin が空なら丸ごと消える）。
// `[...]` の外の変数は、空なら fallback の値に置き換わる。
// フロントの IntroTemplateCard.tsx にプレビュー用の同一ロジックがあるため、変更時は両方揃える。
function renderTemplate(
  template: string,
  vars: Record<string, string>,
  fallback: Record<string, string> = {},
): string {
  const afterOptionalSegments = template.replace(/\[([^[\]]*)\]/g, (whole, inner: string) => {
    const referenced = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (referenced.length === 0) return inner;
    const hasValue = referenced.some((name) => vars[name]);
    return hasValue ? substituteVars(inner, vars) : "";
  });

  return substituteVars(afterOptionalSegments, vars, fallback);
}

function buildIntroDraft(
  org: Pick<
    Organization,
    "visitorIntroSubjectTemplate" | "visitorIntroBodyTemplate" | "visitorIntroLineTemplate"
  >,
  applications: Pick<VisitorApplication, "name" | "partHope" | "originGroup">[],
): { subject: string; body: string } {
  const lines = applications.map((a) =>
    renderTemplate(
      org.visitorIntroLineTemplate,
      { name: a.name, part: a.partHope ?? "", origin: a.originGroup ?? "" },
      { part: "未定", origin: "未定" },
    ),
  );

  return {
    subject: org.visitorIntroSubjectTemplate,
    body: renderTemplate(org.visitorIntroBodyTemplate, { lines: lines.join("\n") }),
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

type ReviewResult =
  | { ok: true; application: VisitorApplication }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT"; message: string; status: 404 | 409 };

// 承認・却下の共通処理（対象の存在確認・pending状態チェック・ステータス更新）
async function reviewApplication(
  org: Organization,
  actingMember: Member,
  id: string,
  status: "approved" | "rejected",
): Promise<ReviewResult> {
  const application = await prisma.visitorApplication.findFirst({
    where: { id, orgId: org.id },
  });
  if (!application) {
    return { ok: false, code: "NOT_FOUND", message: "見学申込が見つかりません", status: 404 };
  }
  if (application.status !== "pending") {
    return { ok: false, code: "CONFLICT", message: "既に処理済みの申込です", status: 409 };
  }

  const updated = await prisma.visitorApplication.update({
    where: { id },
    data: { status, reviewedById: actingMember.id, reviewedAt: new Date() },
  });
  return { ok: true, application: updated };
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

    const result = await reviewApplication(org, actingMember, id, "approved");
    if (!result.ok) {
      return c.json({ error: { code: result.code, message: result.message } }, result.status);
    }

    return c.json({
      data: {
        application: formatApplication(result.application),
        draft: buildIntroDraft(org, [result.application]),
      },
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

    const result = await reviewApplication(org, actingMember, id, "rejected");
    if (!result.ok) {
      return c.json({ error: { code: result.code, message: result.message } }, result.status);
    }

    return c.json({ data: formatApplication(result.application) });
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
          draft: buildIntroDraft(org, updatedApplications),
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
