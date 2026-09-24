import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Organization, User } from "../../generated/prisma/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    session: { findUnique: vi.fn(), update: vi.fn() },
    organization: { findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}));

vi.mock("../../services/org-deletion.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/org-deletion.js")>()),
  purgeExpiredOrgs: vi.fn(),
}));

import { prisma } from "../../lib/prisma.js";
import { purgeExpiredOrgs } from "../../services/org-deletion.js";
import { deletedOrgsRouter, handleOrgPurgeCron } from "../deleted-orgs.js";

function createTestApp() {
  const app = new Hono();
  app.route("/", deletedOrgsRouter);
  return app;
}

const adminUser: User = {
  id: "admin-1",
  email: "sysadmin@example.com",
  passwordHash: "hashed-password",
  nameJa: "システム管理者",
  nameEn: null,
  nameKana: null,
  avatarUrl: null,
  createdAt: new Date("2022-04-01"),
};

const regularUser: User = { ...adminUser, id: "user-1", email: "user@example.com" };

const deletedOrg: Organization = {
  id: "org-1",
  name: "東京男声合唱団",
  slug: "tokyo-men-choir",
  partTemplate: {},
  feeType: "per_rehearsal",
  defaultFeeAmount: null,
  visitorFormToken: null,
  visitorIntroSubjectTemplate: "見学者のご紹介",
  visitorIntroBodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
  visitorIntroLineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
  createdAt: new Date("2024-01-01"),
  deletedAt: new Date("2026-09-01T00:00:00Z"),
  deletedByEmail: "admin@example.com",
};

function mockSession(user: User) {
  process.env.SYSTEM_ADMIN_EMAILS = adminUser.email;
  vi.mocked(prisma.session.findUnique).mockResolvedValue({
    id: "session-abc",
    userId: user.id,
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    isVisitor: false,
    user,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────
// GET /auth/orgs/deleted
// ────────────────────────────

describe("GET /auth/orgs/deleted", () => {
  it("未ログイン: 401を返す", async () => {
    const res = await createTestApp().request("/auth/orgs/deleted");
    expect(res.status).toBe(401);
  });

  it("システム管理者以外: 403を返す", async () => {
    mockSession(regularUser);
    const res = await createTestApp().request("/auth/orgs/deleted", {
      headers: { Cookie: "session=session-abc" },
    });
    expect(res.status).toBe(403);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("システム管理者: 論理削除済み団体を削除日の新しい順に、完全削除予定日付きで返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([deletedOrg]);

    const res = await createTestApp().request("/auth/orgs/deleted", {
      headers: { Cookie: "session=session-abc" },
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });
    expect(body.data).toEqual([
      {
        id: "org-1",
        name: "東京男声合唱団",
        slug: "tokyo-men-choir",
        deletedAt: "2026-09-01T00:00:00.000Z",
        deletedByEmail: "admin@example.com",
        purgeScheduledAt: "2026-10-01T00:00:00.000Z",
      },
    ]);
  });
});

// ────────────────────────────
// POST /auth/orgs/:id/restore
// ────────────────────────────

describe("POST /auth/orgs/:id/restore", () => {
  function postRestore(id: string) {
    return createTestApp().request(`/auth/orgs/${id}/restore`, {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });
  }

  it("システム管理者以外: 403を返し復元しない", async () => {
    mockSession(regularUser);
    const res = await postRestore("org-1");
    expect(res.status).toBe(403);
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("削除済みでない・存在しない団体: 404を返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.organization.updateMany).mockResolvedValue({ count: 0 });
    const res = await postRestore("org-unknown");
    expect(res.status).toBe(404);
  });

  it("成功: 削除済みのときのみdeletedAt・削除者をクリアして団体を返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.organization.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValue({
      ...deletedOrg,
      deletedAt: null,
      deletedByEmail: null,
    });

    const res = await postRestore("org-1");
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", deletedAt: { not: null } },
      data: { deletedAt: null, deletedByEmail: null },
    });
    expect(body.data).toEqual({ id: "org-1", name: "東京男声合唱団", slug: "tokyo-men-choir" });
  });
});

// ────────────────────────────
// handleOrgPurgeCron
// ────────────────────────────

describe("handleOrgPurgeCron", () => {
  function createCronApp() {
    const app = new Hono();
    app.post("/cron/org-purge", handleOrgPurgeCron);
    return app;
  }

  it("Authorizationヘッダーが不一致: 401を返し完全削除しない", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const res = await createCronApp().request("/cron/org-purge", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
    expect(purgeExpiredOrgs).not.toHaveBeenCalled();
  });

  it("正常: 完全削除を実行し件数を返す", async () => {
    process.env.CRON_SECRET = "secret-abc";
    vi.mocked(purgeExpiredOrgs).mockResolvedValue({ purgedCount: 2 });
    const res = await createCronApp().request("/cron/org-purge", {
      method: "POST",
      headers: { Authorization: "Bearer secret-abc" },
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ purgedCount: 2 });
  });
});
