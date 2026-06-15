import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { hash, verify } from "argon2";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { prisma } from "../lib/prisma.js";
import { sessionManager } from "../lib/session.js";
import { checkLoginRateLimit, clearLoginRateLimit, checkResetRateLimit } from "../lib/redis.js";
import { sendPasswordResetEmail } from "../services/mail.js";
import { storage } from "../services/storage.js";
import { logger } from "../lib/logger.js";

const ARGON2_OPTIONS = {
  type: 2,       // Argon2id
  memoryCost: 19456, // 19 MiB (OWASP minimum — serverless 環境でのタイムアウト対策)
  timeCost: 2,
  parallelism: 1,
} as const;

async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

// SHA-256 ハッシュかどうか判定（移行期間中の後方互換）
function isSha256Hash(h: string): boolean {
  return /^[0-9a-f]{64}$/.test(h);
}

function sha256(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isSha256Hash(storedHash)) {
    const computed = Buffer.from(sha256(password), "hex");
    const stored   = Buffer.from(storedHash, "hex");
    return timingSafeEqual(computed, stored);
  }
  return verify(storedHash, password);
}

const IP_REGEX = /^[\d.]+$|^[0-9a-fA-F:]+$/;

function getClientIp(c: Context): string {
  // Vercel インフラが付与する x-vercel-forwarded-for はクライアントによる偽装不可
  const vercelIp = c.req.header("x-vercel-forwarded-for");
  if (vercelIp) {
    const ip = vercelIp.split(",")[0].trim();
    if (IP_REGEX.test(ip)) return ip;
  }
  // ローカル開発環境フォールバック: XFF 末尾 IP（プロキシ付加分）を信頼
  const forwarded = c.req.header("x-forwarded-for");
  const ips = forwarded?.split(",").map((s) => s.trim()).filter((ip) => IP_REGEX.test(ip)) ?? [];
  return ips[ips.length - 1] ?? c.req.header("x-real-ip") ?? "unknown";
}

export const authRouter = new Hono()

  .post(
    "/auth/login",
    zValidator("json", z.object({ email: z.string().email(), password: z.string().min(1) }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const ip = getClientIp(c);
      if (!(await checkLoginRateLimit(ip))) {
        return c.json({ error: { code: "TOO_MANY_REQUESTS", message: "しばらく時間をおいてから再試行してください" } }, 429);
      }

      const { email, password } = c.req.valid("json");

      const user = await prisma.user.findUnique({ where: { email } });
      // ユーザーが存在しない場合でも argon2id の full computation を実行し
      // タイミング攻撃によるメールアドレス存在確認を防ぐ。
      // ダミーハッシュは base64url として有効なフォーマット（16 byte salt / 32 byte hash）
      const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const storedHash = user?.passwordHash ?? DUMMY_HASH;
      const passwordOk = await verifyPassword(password, storedHash);
      if (!user || !passwordOk) {
        return c.json({ error: { code: "UNAUTHORIZED", message: "メールアドレスまたはパスワードが不正です" } }, 401);
      }

      await clearLoginRateLimit(ip);

      // SHA-256 ハッシュでログイン成功した場合は Argon2id に移行
      if (isSha256Hash(user.passwordHash)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: await hashPassword(password) },
        });
      }

      const sessionData = sessionManager.createSession(user.id);
      await prisma.session.create({ data: sessionData });

      setCookie(c, sessionManager.sessionCookieName, sessionData.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/",
        expires: sessionData.expiresAt,
      });

      const memberships = await prisma.member.findMany({
        where: { userId: user.id, status: { not: "suspended" } },
        include: { org: true, part: true },
      });

      return c.json({
        data: {
          user: { id: user.id, nameJa: user.nameJa, email: user.email, avatarUrl: storage.resolveAvatarUrl(user.avatarUrl) },
          orgs: memberships.map((m) => ({
            orgSlug: m.org.slug,
            orgName: m.org.name,
            roles: m.roles,
            partName: m.part?.name ?? null,
            status: m.status,
          })),
        },
      });
    }
  )

  .post("/auth/logout", async (c) => {
    const sessionId = getCookie(c, sessionManager.sessionCookieName);
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
    }
    deleteCookie(c, sessionManager.sessionCookieName, { path: "/" });
    return new Response(null, { status: 204 });
  })

  // ── GET /auth/invite/:token ── トークン情報取得（パスワード設定画面の初期表示用）
  .get("/auth/invite/:token", async (c) => {
    const { token } = c.req.param();
    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      include: { org: { select: { name: true, slug: true } } },
    });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return c.json({ error: { code: "INVALID_TOKEN", message: "招待リンクが無効または期限切れです" } }, 404);
    }

    return c.json({
      data: {
        email: invite.email,
        nameJa: invite.nameJa ?? null,
        orgName: invite.org.name,
        orgSlug: invite.org.slug,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  })

  // ── POST /auth/invite/:token ── 招待受け入れ（ユーザー作成 + メンバー登録）
  .post(
    "/auth/invite/:token",
    zValidator("json", z.object({
      nameJa:   z.string().min(1),
      password: z.string().min(8),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const { token } = c.req.param();
      const { nameJa, password } = c.req.valid("json");

      const invite = await prisma.inviteToken.findUnique({ where: { token } });
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
        return c.json({ error: { code: "INVALID_TOKEN", message: "招待リンクが無効または期限切れです" } }, 404);
      }

      const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
      if (existingUser) {
        const existingMember = await prisma.member.findUnique({
          where: { userId_orgId: { userId: existingUser.id, orgId: invite.orgId } },
        });
        if (existingMember) {
          // usedAt を更新せずに 409 を返す（トークンを消費しない）
          return c.json({ error: { code: "CONFLICT", message: "このメールアドレスはすでに登録済みです" } }, 409);
        }
        // 既存ユーザーはアカウントの所有を証明するためパスワード検証を必須とする
        const valid = await verifyPassword(password, existingUser.passwordHash);
        if (!valid) {
          return c.json({ error: { code: "UNAUTHORIZED", message: "パスワードが正しくありません" } }, 401);
        }
      }

      const user = existingUser ?? await prisma.user.create({
        data: {
          email: invite.email,
          nameJa,
          passwordHash: await hashPassword(password),
        },
      });

      await prisma.member.create({
        data: {
          userId: user.id,
          orgId: invite.orgId,
          roles: invite.roles,
          partId: invite.partId ?? null,
          joinedAt: new Date(),
        },
      });

      await prisma.inviteToken.update({ where: { token }, data: { usedAt: new Date() } });

      return c.json({ data: { message: "登録が完了しました" } }, 201);
    }
  )

  .get("/auth/me", async (c) => {
    const sessionId = getCookie(c, sessionManager.sessionCookieName);
    if (!sessionId) return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);

    const { session, user } = await sessionManager.validateSession(sessionId);
    if (!session || !user) return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);

    const memberships = await prisma.member.findMany({
      where: { userId: user.id, status: { not: "suspended" } },
      include: { org: true, part: true },
    });

    return c.json({
      data: {
        user: { id: user.id, nameJa: user.nameJa, email: user.email, avatarUrl: storage.resolveAvatarUrl(user.avatarUrl) },
        orgs: memberships.map((m) => ({
          orgSlug: m.org.slug,
          orgName: m.org.name,
          memberId: m.id,
          roles: m.roles,
          partName: m.part?.name ?? null,
          status: m.status,
        })),
      },
    });
  })

  // ── POST /auth/password-reset/request ── リセットメール送信
  .post(
    "/auth/password-reset/request",
    zValidator("json", z.object({ email: z.string().email() }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const ip = getClientIp(c);
      if (!(await checkResetRateLimit(ip))) {
        return c.json({ error: { code: "TOO_MANY_REQUESTS", message: "しばらく時間をおいてから再試行してください" } }, 429);
      }

      const { email } = c.req.valid("json");
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間有効
        const resetToken = await prisma.passwordResetToken.create({
          data: { userId: user.id, expiresAt },
        });
        await sendPasswordResetEmail({
          to:         user.email,
          nameJa:     user.nameJa,
          resetToken: resetToken.token,
          expiresAt,
        }).catch((err: unknown) => logger.error("[auth] password reset mail failed:", err));
      }

      // ユーザー存在確認防止のため成功・失敗とも同じレスポンスを返す
      return c.json({ data: { message: "パスワードリセットメールを送信しました" } });
    }
  )

  // ── GET /auth/password-reset/:token ── トークン検証（ページ初期表示用）
  .get("/auth/password-reset/:token", async (c) => {
    const { token } = c.req.param();
    const resetToken = await prisma.passwordResetToken.findUnique({
      where:   { token },
      include: { user: { select: { email: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return c.json({ error: { code: "INVALID_TOKEN", message: "リンクが無効または期限切れです" } }, 404);
    }

    return c.json({ data: { email: resetToken.user.email } });
  })

  // ── POST /auth/password-reset/:token ── パスワード更新
  .post(
    "/auth/password-reset/:token",
    zValidator("json", z.object({ password: z.string().min(8) }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const { token } = c.req.param();
      const { password } = c.req.valid("json");

      // 存在チェック（userId 取得目的）
      const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
      if (!resetToken) {
        return c.json({ error: { code: "INVALID_TOKEN", message: "リンクが無効または期限切れです" } }, 404);
      }

      const passwordHash = await hashPassword(password);

      // 1 SQL でトークンを消費（並行リクエストは count === 0 で弾かれる）
      const claimed = await prisma.passwordResetToken.updateMany({
        where: { token, usedAt: null, expiresAt: { gt: new Date() } },
        data:  { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        return c.json({ error: { code: "INVALID_TOKEN", message: "リンクが無効または期限切れです" } }, 404);
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.userId },
          data:  { passwordHash },
        }),
        prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
      ]);

      return c.json({ data: { message: "パスワードをリセットしました" } });
    }
  )

  // ── POST /auth/orgs ── 団体新規作成
  .post(
    "/auth/orgs",
    zValidator("json", z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンのみ使用できます"),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: r.error.errors[0]?.message ?? "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const sessionId = getCookie(c, sessionManager.sessionCookieName);
      if (!sessionId) return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);

      const { session, user } = await sessionManager.validateSession(sessionId);
      if (!session || !user) return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);

      const { name, slug } = c.req.valid("json");

      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing) {
        return c.json({ error: { code: "CONFLICT", message: "このスラグはすでに使用されています" } }, 409);
      }

      await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name, slug, partTemplate: {} },
        });

        await tx.eventCategory.createMany({
          data: [
            { orgId: org.id, name: "練習",   slug: "rehearsal", color: "#3B82F6", sortOrder: 1 },
            { orgId: org.id, name: "本番",   slug: "concert",   color: "#EF4444", sortOrder: 2 },
            { orgId: org.id, name: "会議",   slug: "meeting",   color: "#F59E0B", sortOrder: 3 },
            { orgId: org.id, name: "その他", slug: "other",     color: "#6B7280", sortOrder: 4 },
          ],
        });

        await tx.member.create({
          data: { userId: user.id, orgId: org.id, roles: ["admin"], joinedAt: new Date() },
        });
      });

      return c.json({ data: { orgSlug: slug, orgName: name } }, 201);
    }
  );
