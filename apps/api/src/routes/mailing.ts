import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../lib/prisma.js";
import { sendBulkMail, getResendEmail } from "../services/mail.js";
import { isMemberPlus, isAdmin } from "../services/access.js";
import { storage } from "../services/storage.js";
import type { TenantEnv } from "../middleware/tenant.js";

const BODY_PREVIEW_LEN = 200;

export const mailingRouter = new Hono<TenantEnv>()

  // ── GET /mailing ── メール一覧
  .get("/mailing", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const perPage = Math.min(50, Math.max(1, Number(c.req.query("perPage") ?? 20)));

    // 全員「送信者 or 受信者」に限定（admin も例外なし）
    const where = {
      orgId: org.id,
      OR: [{ sentById: member.id }, { recipientMemberIds: { has: member.id } }],
    };

    const [total, mails] = await Promise.all([
      prisma.mailLog.count({ where }),
      prisma.mailLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          sentBy: { include: { userRef: { select: { nameJa: true, avatarUrl: true } } } },
        },
      }),
    ]);

    return c.json(
      {
        data: mails.map((m) => ({
          id: m.id,
          sentBy: {
            id: m.sentById,
            nameJa: m.sentBy.userRef.nameJa,
            avatarUrl: storage.resolveAvatarUrl(m.sentBy.userRef.avatarUrl),
          },
          sentAt: m.sentAt.toISOString(),
          recipientCount: m.recipientMemberIds.length,
          subject: m.subject,
          bodyPreview: m.bodyPreview,
        })),
        meta: { total, page, perPage },
      },
      200,
      { "Cache-Control": "no-store" },
    );
  })

  // ── GET /mailing/templates ── テンプレート一覧（/mailing/:id より先に定義）
  .get("/mailing/templates", async (c) => {
    const member = c.get("member");
    const org = c.get("org");

    if (!isMemberPlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "閲覧権限がありません" } }, 403);
    }

    const templates = await prisma.mailTemplate.findMany({
      where: { orgId: org.id },
      orderBy: { updatedAt: "desc" },
      include: { creator: { include: { userRef: { select: { nameJa: true } } } } },
    });
    return c.json({
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        createdBy: { id: t.createdById, nameJa: t.creator.userRef.nameJa },
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  })

  // ── POST /mailing/templates ── テンプレート保存
  .post(
    "/mailing/templates",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
      (result, c) => {
        if (!result.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      if (!isMemberPlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, 403);
      }
      const { name, subject, body } = c.req.valid("json");
      const template = await prisma.mailTemplate.create({
        data: { orgId: org.id, createdById: member.id, name, subject, body },
      });
      return c.json(
        {
          data: {
            id: template.id,
            name: template.name,
            subject: template.subject,
            body: template.body,
            updatedAt: template.updatedAt.toISOString(),
          },
        },
        201,
      );
    },
  )

  // ── PATCH /mailing/templates/:id ── テンプレート更新
  .patch(
    "/mailing/templates/:id",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100).optional(),
        subject: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
      }),
      (result, c) => {
        if (!result.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { id } = c.req.param();
      const template = await prisma.mailTemplate.findFirst({ where: { id, orgId: org.id } });
      if (!template)
        return c.json(
          { error: { code: "NOT_FOUND", message: "テンプレートが見つかりません" } },
          404,
        );
      if (!isAdmin(member) && template.createdById !== member.id)
        return c.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, 403);
      const updated = await prisma.mailTemplate.update({
        where: { id },
        data: c.req.valid("json"),
      });
      return c.json({
        data: {
          id: updated.id,
          name: updated.name,
          subject: updated.subject,
          body: updated.body,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    },
  )

  // ── DELETE /mailing/templates/:id ── テンプレート削除
  .delete("/mailing/templates/:id", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { id } = c.req.param();
    const template = await prisma.mailTemplate.findFirst({ where: { id, orgId: org.id } });
    if (!template)
      return c.json({ error: { code: "NOT_FOUND", message: "テンプレートが見つかりません" } }, 404);
    if (!isAdmin(member) && template.createdById !== member.id)
      return c.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, 403);
    await prisma.mailTemplate.delete({ where: { id, orgId: org.id } });
    return c.body(null, 204);
  })

  // ── GET /mailing/:id ── メール詳細
  .get("/mailing/:id", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { id } = c.req.param();

    const mail = await prisma.mailLog.findUnique({
      where: { id },
      include: { sentBy: { include: { userRef: { select: { nameJa: true } } } } },
    });

    if (!mail || mail.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "メールが見つかりません" } }, 404);
    }

    // 権限チェック: 送信者 / 受信者 以外は 404（admin も例外なし）
    const isSender = mail.sentById === member.id;
    const isRecipient = mail.recipientMemberIds.includes(member.id);

    if (!isSender && !isRecipient) {
      return c.json({ error: { code: "NOT_FOUND", message: "メールが見つかりません" } }, 404);
    }

    // 全 resendId から詳細を並列取得
    const resendDetails = await Promise.all(mail.resendIds.map((rid) => getResendEmail(rid)));

    return c.json({
      data: {
        id: mail.id,
        sentBy: { id: mail.sentById, nameJa: mail.sentBy.userRef.nameJa },
        sentAt: mail.sentAt.toISOString(),
        recipientCount: mail.recipientMemberIds.length,
        recipientMemberIds: mail.recipientMemberIds,
        recipients: resendDetails
          .filter((d): d is NonNullable<typeof d> => d !== null)
          .map((d) => ({
            email: d.to[0] ?? "",
            lastEvent: d.last_event,
          })),
        resend: resendDetails[0]
          ? {
              subject: resendDetails[0].subject,
              html: resendDetails[0].html,
              text: resendDetails[0].text,
              lastEvent: resendDetails[0].last_event,
              createdAt: resendDetails[0].created_at,
            }
          : null,
      },
    });
  })

  // ── POST /mailing/send ── メール送信
  .post(
    "/mailing/send",
    zValidator(
      "json",
      z.object({
        subject: z.string().min(1, "件名を入力してください"),
        body: z.string().min(1, "本文を入力してください"),
        recipientType: z.enum(["all", "part", "role", "custom"]),
        recipientFilter: z
          .object({
            partIds: z.array(z.string()).optional(),
            roles: z.array(z.string()).optional(),
            memberIds: z.array(z.string()).max(500).optional(),
          })
          .nullable()
          .optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isMemberPlus(actingMember)) {
        return c.json(
          { error: { code: "FORBIDDEN", message: "メール送信は一般団員以上のみ可能です" } },
          403,
        );
      }

      const { subject, body, recipientType, recipientFilter } = c.req.valid("json");

      const baseWhere: Prisma.MemberWhereInput = { orgId: org.id, status: "active" };
      if (recipientType === "part" && recipientFilter?.partIds?.length)
        baseWhere.partId = { in: recipientFilter.partIds };
      else if (recipientType === "role" && recipientFilter?.roles?.length)
        baseWhere.roles = { hasSome: recipientFilter.roles };
      else if (recipientType === "custom" && recipientFilter?.memberIds?.length)
        baseWhere.id = { in: recipientFilter.memberIds };

      const members = await prisma.member.findMany({
        where: baseWhere,
        include: { userRef: { select: { email: true } } },
      });

      const emails = members.map((m) => m.userRef.email);
      const recipientMemberIds = members.map((m) => m.id);
      const resendIds = await sendBulkMail({
        to: emails.map((email) => ({ email })),
        subject,
        body,
        orgName: org.name,
      });

      const mailLog = await prisma.mailLog.create({
        data: {
          orgId: org.id,
          sentById: actingMember.id,
          sentAt: new Date(),
          subject,
          bodyPreview: body.slice(0, BODY_PREVIEW_LEN),
          resendIds,
          recipientMemberIds,
        },
      });

      return c.json(
        {
          data: {
            mailLogId: mailLog.id,
            recipientCount: emails.length,
            sentAt: mailLog.sentAt.toISOString(),
          },
        },
        201,
      );
    },
  );
