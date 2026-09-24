import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";
import { requireSystemAdmin } from "../middleware/system-admin.js";
import { checkInquiryRateLimit } from "../lib/redis.js";
import { getClientIp } from "../lib/request.js";
import { getSystemAdminEmails } from "../lib/systemAdmin.js";
import { sendBulkMail } from "../services/mail.js";
import { logger } from "../lib/logger.js";
import { InquiryCategory, InquiryStatus } from "../generated/prisma/index.js";

const CATEGORY_LABELS: Record<InquiryCategory, string> = {
  org_restore: "削除した団体の復元",
  account: "アカウント・ログイン",
  privacy: "個人情報の開示・訂正・削除",
  bug_report: "不具合の報告",
  other: "その他",
};

const createInquirySchema = z.object({
  category: z.enum(InquiryCategory),
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  orgName: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1).max(2000),
});

const listQuerySchema = z.object({
  status: z.enum(InquiryStatus).default("open"),
});

function validationError(message: string | undefined) {
  return { error: { code: "VALIDATION_ERROR", message: message ?? "入力値が不正です" } };
}

// authMiddleware/requireSystemAdmin を各ルートに個別指定する理由は org-applications.ts の adminRouter を参照
export const inquiriesRouter = new Hono<AuthEnv>()

  // ── POST /auth/inquiries ── 運営への問い合わせ（公開・認証不要）
  .post(
    "/auth/inquiries",
    zValidator("json", createInquirySchema, (r, c) => {
      if (!r.success) return c.json(validationError(r.error.issues[0]?.message), 400);
    }),
    async (c) => {
      if (!(await checkInquiryRateLimit(getClientIp(c)))) {
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

      const { category, name, email, orgName, message } = c.req.valid("json");
      await prisma.inquiry.create({
        data: { category, name, email, orgName: orgName || null, message },
      });

      const adminEmails = getSystemAdminEmails();
      if (adminEmails.length === 0) {
        logger.warn("[inquiries] SYSTEM_ADMIN_EMAILS 未設定のため通知メールを送信できません");
      } else {
        try {
          await sendBulkMail({
            to: adminEmails.map((adminEmail) => ({ email: adminEmail })),
            subject: `【ChoirHub】お問い合わせ（${CATEGORY_LABELS[category]}）`,
            body: [
              `種別: ${CATEGORY_LABELS[category]}`,
              `氏名: ${name}`,
              `メールアドレス: ${email}`,
              ...(orgName ? [`団体名: ${orgName}`] : []),
              "",
              message,
            ].join("\n"),
            orgName: "ChoirHub 運営",
          });
        } catch (mailErr) {
          logger.error("[inquiries] 問い合わせ通知メール送信失敗:", mailErr);
        }
      }

      return c.json({ data: { message: "送信しました" } }, 201);
    },
  )

  // ── GET /auth/inquiries ── 問い合わせ一覧（システム管理者のみ）
  .get(
    "/auth/inquiries",
    authMiddleware,
    requireSystemAdmin,
    zValidator("query", listQuerySchema, (r, c) => {
      if (!r.success) return c.json(validationError(r.error.issues[0]?.message), 400);
    }),
    async (c) => {
      const { status } = c.req.valid("query");
      const inquiries = await prisma.inquiry.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
      });
      return c.json({ data: inquiries });
    },
  )

  // ── POST /auth/inquiries/:id/resolve ── 対応済みにする（システム管理者のみ）
  .post("/auth/inquiries/:id/resolve", authMiddleware, requireSystemAdmin, async (c) => {
    const { id } = c.req.param();
    const { count } = await prisma.inquiry.updateMany({
      where: { id, status: "open" },
      data: { status: "resolved", resolvedByEmail: c.get("user").email, resolvedAt: new Date() },
    });
    if (count === 0) {
      const exists = await prisma.inquiry.findUnique({ where: { id }, select: { id: true } });
      return exists
        ? c.json({ error: { code: "CONFLICT", message: "既に対応済みです" } }, 409)
        : c.json({ error: { code: "NOT_FOUND", message: "問い合わせが見つかりません" } }, 404);
    }
    const inquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id } });
    return c.json({ data: inquiry });
  });
