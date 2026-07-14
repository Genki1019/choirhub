import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { User } from "../../generated/prisma/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    member: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    inviteToken: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../../lib/redis.js", () => ({
  checkLoginRateLimit: vi.fn(),
  clearLoginRateLimit: vi.fn(),
  checkResetRateLimit: vi.fn(),
}));

vi.mock("argon2", () => ({
  hash: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("../../services/mail.js", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

import { prisma } from "../../lib/prisma.js";
import { checkLoginRateLimit } from "../../lib/redis.js";
import { verify, hash } from "argon2";
import { authRouter } from "../auth.js";

function createTestApp() {
  const app = new Hono();
  app.route("/", authRouter);
  return app;
}

// ────────────────────────────
// テスト用フィクスチャ
// ────────────────────────────

const testUser: User = {
  id: "user-1",
  email: "test@example.com",
  passwordHash: "hashed-password",
  nameJa: "山田 太郎",
  nameEn: "Taro Yamada",
  nameKana: "ヤマダ タロウ",
  avatarUrl: null,
  createdAt: new Date("2022-04-01"),
};

const testMembership = {
  roles: ["member"],
  status: "active",
  org: { slug: "tokyo-men-choir", name: "東京男声合唱団" },
  part: { name: "Tenor I" },
};

const testInvite = {
  token: "invite-token-abc",
  email: "new@example.com",
  nameJa: "新人 太郎",
  orgId: "org-1",
  roles: ["member"],
  partId: "part-1",
  usedAt: null as Date | null,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /auth/login", () => {
  it("バリデーションエラー: 不正なemailは400を返す", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "不正な値", password: "..." }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("レート制限中: 429を返す", async () => {
    vi.mocked(checkLoginRateLimit).mockResolvedValue(false);

    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    });

    expect(res.status).toBe(429);
    const body = await json(res);
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("存在しないメールアドレス: 401を返す", async () => {
    vi.mocked(checkLoginRateLimit).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(verify).mockResolvedValue(false);

    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "notfound@example.com", password: "password123" }),
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("パスワード不一致: 401を返す（存在しないメールと同じレスポンス）", async () => {
    vi.mocked(checkLoginRateLimit).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(verify).mockResolvedValue(false);

    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: "wrong-password" }),
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("正常ログイン: 200を返しCookieがセットされ、レスポンスにユーザーと所属団体が含まれる", async () => {
    vi.mocked(checkLoginRateLimit).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(verify).mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.session.create).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([testMembership] as any);

    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: "correct-password" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session=");

    const body = await json(res);
    expect(body.data.user).toEqual({
      id: testUser.id,
      nameJa: testUser.nameJa,
      email: testUser.email,
      avatarUrl: null,
    });
    expect(body.data.orgs).toEqual([
      {
        orgSlug: "tokyo-men-choir",
        orgName: "東京男声合唱団",
        roles: ["member"],
        partName: "Tenor I",
        status: "active",
      },
    ]);
  });
});

describe("POST /auth/logout", () => {
  it("Cookieあり: 204を返しセッションが削除される", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/logout", {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(204);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: "session-abc" } });
  });

  it("Cookieなし: それでも204を返し、セッション削除は呼ばれない", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/logout", { method: "POST" });

    expect(res.status).toBe(204);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});

describe("GET /auth/me", () => {
  it("Cookieなし: 401を返す", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/me");

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("セッションが無効: 401を返す", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request("/auth/me", {
      headers: { Cookie: "session=invalid-session" },
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("正常: 200を返し、ユーザーとmemberId付きの所属団体一覧を返す", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "session-abc",
      userId: testUser.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: testUser,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { ...testMembership, id: "member-1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp();
    const res = await app.request("/auth/me", {
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.user).toEqual({
      id: testUser.id,
      nameJa: testUser.nameJa,
      email: testUser.email,
      avatarUrl: null,
    });
    expect(body.data.orgs).toEqual([
      {
        orgSlug: "tokyo-men-choir",
        orgName: "東京男声合唱団",
        memberId: "member-1",
        roles: ["member"],
        partName: "Tenor I",
        status: "active",
      },
    ]);
  });
});

describe("GET /auth/invite/:token", () => {
  it("トークンが存在しない: 404 INVALID_TOKENを返す", async () => {
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request("/auth/invite/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("INVALID_TOKEN");
  });

  it("使用済み: 404 TOKEN_USEDを返す", async () => {
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue({
      ...testInvite,
      usedAt: new Date("2022-01-01"),
      org: { name: "東京男声合唱団", slug: "tokyo-men-choir" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`);

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("TOKEN_USED");
  });

  it("期限切れ: 404 TOKEN_EXPIREDを返す", async () => {
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue({
      ...testInvite,
      expiresAt: new Date("2022-01-01"),
      org: { name: "東京男声合唱団", slug: "tokyo-men-choir" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`);

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("正常: 200を返し招待情報を返す", async () => {
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue({
      ...testInvite,
      org: { name: "東京男声合唱団", slug: "tokyo-men-choir" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      email: testInvite.email,
      nameJa: testInvite.nameJa,
      orgName: "東京男声合唱団",
      orgSlug: "tokyo-men-choir",
      expiresAt: testInvite.expiresAt.toISOString(),
    });
  });
});

describe("POST /auth/invite/:token", () => {
  it("バリデーションエラー: nameJa空は400を返す", async () => {
    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "", password: "password123" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("無効なトークン: 404を返す", async () => {
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request("/auth/invite/nonexistent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "新人 太郎", password: "password123" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("INVALID_TOKEN");
  });

  it("既存ユーザーが既にそのteamのメンバー: 409を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue(testInvite as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-1" } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "新人 太郎", password: "password123" }),
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("既存ユーザーだがパスワード不一致: 401を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue(testInvite as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    vi.mocked(verify).mockResolvedValue(false);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "新人 太郎", password: "wrong-password" }),
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("既存ユーザー・パスワード一致: 201を返し既存ユーザーにMemberが追加される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue(testInvite as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    vi.mocked(verify).mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.create).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inviteToken.update).mockResolvedValue({} as any);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "新人 太郎", password: "correct-password" }),
    });

    expect(res.status).toBe(201);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        userId: testUser.id,
        orgId: testInvite.orgId,
        roles: testInvite.roles,
        partId: testInvite.partId,
        joinedAt: expect.any(Date),
      },
    });
    expect(prisma.inviteToken.update).toHaveBeenCalledWith({
      where: { token: testInvite.token },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("新規ユーザー: 201を返しUser・Memberが新規作成される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inviteToken.findUnique).mockResolvedValue(testInvite as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(hash).mockResolvedValue("hashed-new-password");
    vi.mocked(prisma.user.create).mockResolvedValue(testUser);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.create).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inviteToken.update).mockResolvedValue({} as any);

    const app = createTestApp();
    const res = await app.request(`/auth/invite/${testInvite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "新人 太郎", password: "correct-password" }),
    });

    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: testInvite.email,
        nameJa: "新人 太郎",
        passwordHash: "hashed-new-password",
      },
    });
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        userId: testUser.id,
        orgId: testInvite.orgId,
        roles: testInvite.roles,
        partId: testInvite.partId,
        joinedAt: expect.any(Date),
      },
    });
  });
});
