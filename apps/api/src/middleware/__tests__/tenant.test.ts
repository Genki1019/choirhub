import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Member, Organization } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    member: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { tenantMiddleware } from "../tenant.js";

const testOrg: Organization = {
  id: "org-1",
  name: "東京男声合唱団",
  slug: "tokyo-men-choir",
  partTemplate: {},
  monthlyOrganizer: null,
  feeType: "per_rehearsal",
  defaultFeeAmount: null,
  visitorFormToken: null,
  visitorIntroSubjectTemplate: "見学者のご紹介",
  visitorIntroBodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
  visitorIntroLineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
  createdAt: new Date("2024-01-01"),
};

const testMember: Member = {
  id: "member-1",
  userId: "user-1",
  orgId: "org-1",
  partId: null,
  memberTypeId: null,
  roles: ["member"],
  status: "active",
  bio: null,
  job: null,
  interests: null,
  originGroup: null,
  joinedAt: new Date("2022-04-01"),
  deletedAt: null,
  phone: null,
  adminMemo: null,
  calendarFeedToken: null,
  createdAt: new Date("2022-04-01"),
};

function createTestApp() {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("user", {
      id: "user-1",
      nameJa: "山田太郎",
      email: "yamada@example.com",
      avatarUrl: null,
    });
    return next();
  });
  app.use("/:orgSlug/*", tenantMiddleware);
  app.get("/:orgSlug/ping", (c) => {
    const org = c.get("org");
    const member = c.get("member");
    return c.json({ data: { orgId: org.id, memberId: member.id } });
  });
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("tenantMiddleware", () => {
  it("存在しないorgSlug: 404を返す", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request("/unknown-org/ping");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("団体は存在するがメンバーでない: 403を返す", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request("/tokyo-men-choir/ping");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("退会済み（deletedAtあり）メンバー: 403を返す", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      ...testMember,
      deletedAt: new Date("2026-01-01"),
    });

    const app = createTestApp();
    const res = await app.request("/tokyo-men-choir/ping");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常系: orgとmemberがcontextにセットされ後続ハンドラが実行される", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(testMember);

    const app = createTestApp();
    const res = await app.request("/tokyo-men-choir/ping");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ orgId: "org-1", memberId: "member-1" });
  });
});
