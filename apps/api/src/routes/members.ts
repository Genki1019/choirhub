import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";
import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isHiddenRole, EXCLUDE_HIDDEN_ROLES } from "../services/access.js";
import { sendInviteEmail } from "../services/mail.js";
import { storage } from "../services/storage.js";
import { logger } from "../lib/logger.js";
import { toDateString } from "../lib/date.js";
import type { TenantEnv } from "../middleware/tenant.js";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const memberInclude = {
  userRef:    true,
  part:       true,
  memberType: true,
} as const;

type MemberWithRelations = Prisma.MemberGetPayload<{ include: typeof memberInclude }>;

function formatMember(m: MemberWithRelations, includeContact: boolean, includeAdmin: boolean) {
  const base = {
    id: m.id,
    nameJa: m.userRef.nameJa,
    nameEn: m.userRef.nameEn,
    nameKana: m.userRef.nameKana,
    avatarUrl: storage.resolveAvatarUrl(m.userRef.avatarUrl),
    part: m.part
      ? { id: m.part.id, name: m.part.name, voiceType: m.part.voiceType, sortOrder: m.part.sortOrder }
      : null,
    memberType: m.memberType
      ? { id: m.memberType.id, name: m.memberType.name, defaultFeeAmount: m.memberType.defaultFeeAmount }
      : null,
    roles: m.roles,
    status: m.status,
    bio: m.bio,
    job: m.job,
    interests: m.interests,
    originGroup: m.originGroup,
    joinedAt: m.joinedAt ? toDateString(m.joinedAt) : null,
  };

  const contact = includeContact ? { email: m.userRef.email }                  : {};
  const admin   = includeAdmin   ? { phone: m.phone, adminMemo: m.adminMemo } : {};
  return { ...base, ...contact, ...admin };
}

export const membersRouter = new Hono<TenantEnv>()

  // ── GET /parts ──
  .get("/parts", async (c) => {
    const org = c.get("org");
    const parts = await prisma.part.findMany({
      where: { orgId: org.id },
      orderBy: { sortOrder: "asc" },
    });
    return c.json({ data: parts.map((p) => ({ id: p.id, name: p.name, voiceType: p.voiceType, sortOrder: p.sortOrder })) });
  })

  // ── GET /members ──
  .get("/members", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { partId, status, role } = c.req.query();

    const where: Record<string, unknown> = { orgId: org.id, ...EXCLUDE_HIDDEN_ROLES };
    if (partId) where.partId = partId;
    if (status) where.status = status;
    if (role) where.roles = { has: role };

    const members = await prisma.member.findMany({
      where: { ...where, deletedAt: null },
      include: memberInclude,
      orderBy: { createdAt: "asc" },
    });

    const admin = isAdmin(actingMember);
    return c.json({ data: members.map((m) => formatMember(m, admin, admin)) });
  })

  // ── GET /members/me ──
  .get("/members/me", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const member = await prisma.member.findUnique({
      where: { userId_orgId: { userId: actingMember.userId, orgId: org.id } },
      include: memberInclude,
    });

    if (!member) {
      return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
    }

    return c.json({ data: formatMember(member, true, true) });
  })

  // ── POST /members/me/avatar ──
  .post("/members/me/avatar", async (c) => {
    const actingMember = c.get("member");

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: { code: "BAD_REQUEST", message: "ファイルが見つかりません" } }, 400);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return c.json({ error: { code: "BAD_REQUEST", message: "JPEG・PNG・WebP・GIF のみアップロードできます" } }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: { code: "BAD_REQUEST", message: "ファイルサイズは4MB以内にしてください" } }, 400);
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: actingMember.userId },
      select: { avatarUrl: true },
    });

    const MIME_TO_EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
    const ext        = MIME_TO_EXT[file.type] ?? ".jpg";
    const storageKey = `avatars/${randomUUID()}${ext}`;

    await storage.upload(storageKey, Buffer.from(await file.arrayBuffer()), file.type);
    await storage.delete(currentUser?.avatarUrl ?? null);

    await prisma.user.update({
      where: { id: actingMember.userId },
      data:  { avatarUrl: storageKey },
    });

    return c.json({ data: { avatarUrl: storage.resolveAvatarUrl(storageKey) } });
  })

  // ── PATCH /members/me ──
  .patch(
    "/members/me",
    zValidator("json", z.object({
      nameJa:   z.string().min(1).optional(),
      nameEn:   z.string().optional().nullable(),
      nameKana: z.string().optional().nullable(),
      bio: z.string().optional().nullable(),
      job: z.string().optional().nullable(),
      interests: z.string().optional().nullable(),
      originGroup: z.string().optional().nullable(),
      avatarUrl: z.string().url().optional().nullable(),
      phone: z.string().optional().nullable(),
    }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: result.error.flatten() } }, 400);
      }
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const body = c.req.valid("json");

      const { nameJa, nameEn, nameKana, avatarUrl, ...memberFields } = body;

      if (nameJa !== undefined || nameEn !== undefined || nameKana !== undefined || avatarUrl !== undefined) {
        if (avatarUrl === null) {
          const currentUser = await prisma.user.findUnique({
            where: { id: actingMember.userId },
            select: { avatarUrl: true },
          });
          await storage.delete(currentUser?.avatarUrl ?? null);
        }

        try {
          await prisma.user.update({
            where: { id: actingMember.userId },
            data: {
              ...(nameJa   !== undefined && { nameJa }),
              ...(nameEn   !== undefined && { nameEn }),
              ...(nameKana !== undefined && { nameKana }),
              ...(avatarUrl !== undefined && { avatarUrl }),
            },
          });
        } catch (e: unknown) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            return c.json({ error: { code: "CONFLICT", message: "このメールアドレスは既に使用されています" } }, 409);
          }
          logger.error("[PATCH /members/me] Unexpected error:", e);
          return c.json({ error: { code: "INTERNAL_ERROR", message: "予期しないエラーが発生しました" } }, 500);
        }
      }

      try {
        await prisma.member.update({
          where: { userId_orgId: { userId: actingMember.userId, orgId: org.id } },
          data: memberFields,
        });
      } catch (e: unknown) {
        logger.error("[PATCH /members/me] member update error:", e);
        return c.json({ error: { code: "INTERNAL_ERROR", message: "プロフィールの更新に失敗しました" } }, 500);
      }

      const updated = await prisma.member.findUnique({
        where: { userId_orgId: { userId: actingMember.userId, orgId: org.id } },
        include: memberInclude,
      });
      if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);

      return c.json({ data: formatMember(updated, true, true) });
    }
  )

  // ── POST /members/invite ──
  .post(
    "/members/invite",
    zValidator("json", z.object({
      email: z.string().email(),
      nameJa: z.string().min(1).optional(),
      roles: z.array(z.enum(["admin", "tech", "conductor", "score", "ticket", "finance", "member", "guest", "visitor"])).default(["member"]),
      partId: z.string().cuid().optional(),
    }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: result.error.flatten() } }, 400);
      }
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { email, nameJa, roles, partId } = c.req.valid("json");

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMember = await prisma.member.findUnique({
          where: { userId_orgId: { userId: existingUser.id, orgId: org.id } },
        });
        if (existingMember) {
          return c.json({ error: { code: "CONFLICT", message: "すでに団体に登録済みのメールアドレスです" } }, 409);
        }
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await prisma.inviteToken.create({
        data: { email, nameJa, orgId: org.id, roles, partId, expiresAt },
      });

      try {
        await sendInviteEmail({ to: email, nameJa: nameJa ?? null, orgName: org.name, inviteToken: invite.token, expiresAt });
      } catch (mailErr) {
        logger.error("[invite] メール送信失敗（招待トークンは有効）:", mailErr);
      }

      return c.json({ data: { inviteToken: invite.token, expiresAt: expiresAt.toISOString() } }, 201);
    }
  )

  // ── GET /members/:id ──
  .get("/members/:id", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    const member = await prisma.member.findUnique({
      where: { id },
      include: memberInclude,
    });

    if (!member || member.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
    }

    if (isHiddenRole(member) && !isAdmin(actingMember)) {
      return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
    }

    const admin = isAdmin(actingMember);
    return c.json({ data: formatMember(member, admin, admin) });
  })

  // ── PATCH /members/:id ──
  .patch(
    "/members/:id",
    zValidator("json", z.object({
      roles:        z.array(z.enum(["admin", "tech", "conductor", "score", "ticket", "finance", "member", "guest", "visitor"])).optional(),
      partId:       z.string().cuid().optional().nullable(),
      memberTypeId: z.string().cuid().optional().nullable(),
      status:       z.enum(["active", "offstage"]).optional(),
      phone:        z.string().optional().nullable(),
      adminMemo:    z.string().optional().nullable(),
    }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: result.error.flatten() } }, 400);
      }
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { id } = c.req.param();

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const target = await prisma.member.findUnique({ where: { id } });
      if (!target || target.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
      }

      await prisma.member.update({
        where: { id },
        data: c.req.valid("json"),
      });

      const updated = await prisma.member.findUnique({
        where: { id },
        include: memberInclude,
      });
      if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);

      return c.json({ data: formatMember(updated, true, isAdmin(actingMember)) });
    }
  )

  // ── DELETE /members/:id （ソフトデリート）──
  .delete("/members/:id", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const target = await prisma.member.findUnique({ where: { id } });
    if (!target || target.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
    }
    if (target.id === actingMember.id) {
      return c.json({ error: { code: "FORBIDDEN", message: "自分自身を退団処理できません" } }, 403);
    }

    await prisma.member.update({ where: { id }, data: { deletedAt: new Date() } });
    return c.json({ data: { success: true } });
  });
