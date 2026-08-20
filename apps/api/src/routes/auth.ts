import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { hash, verify } from "argon2";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { prisma } from "../lib/prisma.js";
import { sessionManager } from "../lib/session.js";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  checkResetRateLimit,
  checkInviteAcceptRateLimit,
  clearInviteAcceptRateLimit,
} from "../lib/redis.js";
import { sendPasswordResetEmail } from "../services/mail.js";
import { storage } from "../services/storage.js";
import { logger } from "../lib/logger.js";
import { isSystemAdmin } from "../lib/systemAdmin.js";
import { getClientIp } from "../lib/request.js";
import { Prisma } from "../generated/prisma/index.js";

const ARGON2_OPTIONS = {
  type: 2, // Argon2id
  memoryCost: 19456, // 19 MiB (OWASP minimum — serverless 環境でのタイムアウト対策)
  timeCost: 2,
  parallelism: 1,
} as const;

async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return verify(storedHash, password);
}

async function issueSession(c: Context, userId: string): Promise<void> {
  const sessionData = sessionManager.createSession(userId);
  await prisma.session.create({ data: sessionData });
  setCookie(c, sessionManager.sessionCookieName, sessionData.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    expires: sessionData.expiresAt,
  });
}

const INVALID_TOKEN_ERROR = { code: "INVALID_TOKEN", message: "招待リンクが無効です" } as const;

function usedOrExpiredInviteError(invite: {
  usedAt: Date | null;
  expiresAt: Date;
}): { code: string; message: string } | null {
  if (invite.usedAt) return { code: "TOKEN_USED", message: "この招待リンクは既に使用されています" };
  if (invite.expiresAt < new Date())
    return { code: "TOKEN_EXPIRED", message: "招待リンクの有効期限が切れています" };
  return null;
}

const RESET_INVALID_TOKEN_ERROR = { code: "INVALID_TOKEN", message: "リンクが無効です" } as const;

function usedOrExpiredResetTokenError(resetToken: {
  usedAt: Date | null;
  expiresAt: Date;
}): { code: string; message: string } | null {
  if (resetToken.usedAt) return { code: "TOKEN_USED", message: "このリンクは既に使用されています" };
  if (resetToken.expiresAt < new Date())
    return { code: "TOKEN_EXPIRED", message: "リンクの有効期限が切れています" };
  return null;
}

export const authRouter = new Hono()

  .post(
    "/auth/login",
    zValidator(
      "json",
      z.object({ email: z.string().email(), password: z.string().min(1) }),
      (r, c) => {
        if (!r.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const ip = getClientIp(c);
      if (!(await checkLoginRateLimit(ip))) {
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

      const { email, password } = c.req.valid("json");

      const user = await prisma.user.findUnique({ where: { email } });
      // ユーザーが存在しない場合でも argon2id の full computation を実行し
      // タイミング攻撃によるメールアドレス存在確認を防ぐ。
      // ダミーハッシュは base64url として有効なフォーマット（16 byte salt / 32 byte hash）
      const DUMMY_HASH =
        "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const storedHash = user?.passwordHash ?? DUMMY_HASH;
      const passwordOk = await verifyPassword(password, storedHash);
      if (!user || !passwordOk) {
        return c.json(
          { error: { code: "UNAUTHORIZED", message: "メールアドレスまたはパスワードが不正です" } },
          401,
        );
      }

      await clearLoginRateLimit(ip);
      await issueSession(c, user.id);

      const memberships = await prisma.member.findMany({
        where: { userId: user.id, deletedAt: null },
        include: { org: true, part: true },
      });

      return c.json({
        data: {
          user: {
            id: user.id,
            nameJa: user.nameJa,
            email: user.email,
            avatarUrl: storage.resolveAvatarUrl(user.avatarUrl),
            isSystemAdmin: isSystemAdmin(user.email),
          },
          orgs: memberships.map((m) => ({
            orgSlug: m.org.slug,
            orgName: m.org.name,
            roles: m.roles,
            partName: m.part?.name ?? null,
            status: m.status,
          })),
        },
      });
    },
  )

  // ── POST /auth/logout ── セッション破棄
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

    if (!invite) return c.json({ error: INVALID_TOKEN_ERROR }, 404);
    const err = usedOrExpiredInviteError(invite);
    if (err) return c.json({ error: err }, 404);

    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

    return c.json({
      data: {
        email: invite.email,
        nameJa: invite.nameJa ?? null,
        orgName: invite.org.name,
        orgSlug: invite.org.slug,
        expiresAt: invite.expiresAt.toISOString(),
        isExistingUser: existingUser !== null,
      },
    });
  })

  // ── POST /auth/invite/:token ── 招待受け入れ（ユーザー作成 + メンバー登録）
  .post(
    "/auth/invite/:token",
    zValidator(
      "json",
      z.object({
        nameJa: z.string().min(1).optional(),
        // 既存ユーザーは新規パスワード設定ではなく既存パスワードの照合に使うため、
        // ここでは長さを問わない（8文字未満チェックは新規ユーザー作成時のみ後段で行う）
        password: z.string().min(1),
      }),
      (r, c) => {
        if (!r.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const { token } = c.req.param();
      const { nameJa, password } = c.req.valid("json");

      const invite = await prisma.inviteToken.findUnique({
        where: { token },
        include: { org: { select: { slug: true } } },
      });
      if (!invite) return c.json({ error: INVALID_TOKEN_ERROR }, 404);
      const tokenErr = usedOrExpiredInviteError(invite);
      if (tokenErr) return c.json({ error: tokenErr }, 404);

      const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
      if (existingUser) {
        const existingMember = await prisma.member.findUnique({
          where: { userId_orgId: { userId: existingUser.id, orgId: invite.orgId } },
        });
        if (existingMember) {
          // usedAt を更新せずに 409 を返す（トークンを消費しない）
          return c.json(
            { error: { code: "CONFLICT", message: "このメールアドレスはすでに登録済みです" } },
            409,
          );
        }

        // パスワード照合（総当たり対象）は有効なトークンを持つ相手にのみ発生するため、
        // ここまで来て初めて制限する（無効なトークンだけで無関係な予算を消費させない）
        const ip = getClientIp(c);
        if (!(await checkInviteAcceptRateLimit(ip))) {
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

        // 既存ユーザーはアカウントの所有を証明するためパスワード検証を必須とする
        const valid = await verifyPassword(password, existingUser.passwordHash);
        if (!valid) {
          return c.json(
            { error: { code: "UNAUTHORIZED", message: "パスワードが正しくありません" } },
            401,
          );
        }
        await clearInviteAcceptRateLimit(ip);
      } else if (!nameJa) {
        return c.json(
          { error: { code: "VALIDATION_ERROR", message: "お名前を入力してください" } },
          400,
        );
      } else if (password.length < 8) {
        return c.json(
          {
            error: { code: "VALIDATION_ERROR", message: "パスワードは8文字以上で入力してください" },
          },
          400,
        );
      }

      const user =
        existingUser ??
        (await prisma.user.create({
          data: {
            email: invite.email,
            nameJa: nameJa!,
            passwordHash: await hashPassword(password),
          },
        }));

      try {
        await prisma.member.create({
          data: {
            userId: user.id,
            orgId: invite.orgId,
            roles: invite.roles,
            partId: invite.partId ?? null,
            joinedAt: new Date(),
          },
        });
      } catch (err) {
        // existingMember チェックとこの作成の間の競合（同時クリック・リトライ）を捕捉する
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return c.json(
            { error: { code: "CONFLICT", message: "このメールアドレスはすでに登録済みです" } },
            409,
          );
        }
        throw err;
      }

      await prisma.inviteToken.update({ where: { token }, data: { usedAt: new Date() } });

      // 既存ユーザーはパスワード検証で本人確認済みのため、そのままセッションを発行して
      // 新規団体の画面へ直接遷移できるようにする（新規ユーザーは/loginから通常フローで入る）
      if (existingUser) {
        await issueSession(c, user.id);
      }

      return c.json(
        {
          data: {
            message: "登録が完了しました",
            ...(existingUser && { orgSlug: invite.org.slug }),
          },
        },
        201,
      );
    },
  )

  // ── GET /auth/me ── 現在のログインユーザー情報取得
  .get("/auth/me", async (c) => {
    const sessionId = getCookie(c, sessionManager.sessionCookieName);
    if (!sessionId)
      return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);

    const { session, user } = await sessionManager.validateSession(sessionId);
    if (!session || !user)
      return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);

    const memberships = await prisma.member.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { org: true, part: true },
    });

    return c.json({
      data: {
        user: {
          id: user.id,
          nameJa: user.nameJa,
          email: user.email,
          avatarUrl: storage.resolveAvatarUrl(user.avatarUrl),
          isSystemAdmin: isSystemAdmin(user.email),
        },
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
      if (!r.success)
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const ip = getClientIp(c);
      if (!(await checkResetRateLimit(ip))) {
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

      const { email } = c.req.valid("json");
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間有効
        const resetToken = await prisma.passwordResetToken.create({
          data: { userId: user.id, expiresAt },
        });
        await sendPasswordResetEmail({
          to: user.email,
          nameJa: user.nameJa,
          resetToken: resetToken.token,
          expiresAt,
        }).catch((err: unknown) => logger.error("[auth] password reset mail failed:", err));
      } else {
        // ユーザー存在確認防止のため、DB書き込み・メール送信相当の待機時間を確保する
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // ユーザー存在確認防止のため成功・失敗とも同じレスポンスを返す
      return c.json({ data: { message: "パスワードリセットメールを送信しました" } });
    },
  )

  // ── GET /auth/password-reset/:token ── トークン検証（ページ初期表示用）
  .get("/auth/password-reset/:token", async (c) => {
    const { token } = c.req.param();
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken) return c.json({ error: RESET_INVALID_TOKEN_ERROR }, 404);
    const tokenErr = usedOrExpiredResetTokenError(resetToken);
    if (tokenErr) return c.json({ error: tokenErr }, 404);

    const user = await prisma.user.findUnique({
      where: { id: resetToken.userId },
      select: { email: true },
    });
    if (!user) return c.json({ error: RESET_INVALID_TOKEN_ERROR }, 404);

    return c.json({ data: { email: user.email } });
  })

  // ── POST /auth/password-reset/:token ── パスワード更新
  .post(
    "/auth/password-reset/:token",
    zValidator("json", z.object({ password: z.string().min(8) }), (r, c) => {
      if (!r.success)
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const { token } = c.req.param();
      const { password } = c.req.valid("json");

      // 存在チェック（userId 取得目的）
      const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
      if (!resetToken) {
        return c.json(
          { error: { code: "INVALID_TOKEN", message: "リンクが無効または期限切れです" } },
          404,
        );
      }

      const passwordHash = await hashPassword(password);

      // 1 SQL でトークンを消費（並行リクエストは 0 行更新で弾かれる）
      // NeonHTTP は updateMany が内部トランザクションを要求するため $executeRaw を使用
      // expires_at は TIMESTAMP (UTC値) のため、NOW() を UTC に変換して比較する
      const updatedCount = await prisma.$executeRaw`
        UPDATE password_reset_tokens
        SET used_at = (NOW() AT TIME ZONE 'UTC')
        WHERE token = ${token} AND used_at IS NULL AND expires_at > (NOW() AT TIME ZONE 'UTC')
      `;
      if (updatedCount === 0) {
        return c.json(
          { error: { code: "INVALID_TOKEN", message: "リンクが無効または期限切れです" } },
          404,
        );
      }

      await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      await prisma.session.deleteMany({ where: { userId: resetToken.userId } });

      return c.json({ data: { message: "パスワードをリセットしました" } });
    },
  );
