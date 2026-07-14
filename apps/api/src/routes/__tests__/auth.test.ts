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
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { create: vi.fn() },
    member: { findMany: vi.fn() },
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
import { verify } from "argon2";
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
