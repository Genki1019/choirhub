import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Member, Organization } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    organization: { update: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { settingsRouter } from "../settings.js";

// ────────────────────────────
// テスト用フィクスチャ
// ────────────────────────────

const testOrg: Organization = {
  id: "org-1",
  name: "東京男声合唱団",
  slug: "tokyo-men-choir",
  partTemplate: {},
  monthlyOrganizer: null,
  feeType: "per_rehearsal",
  defaultFeeAmount: null,
  createdAt: new Date("2024-01-01"),
};

const makeMember = (roles: string[], id = "member-1"): Member => ({
  id,
  userId: `user-${id}`,
  orgId: "org-1",
  partId: null,
  memberTypeId: null,
  roles,
  status: "active",
  bio: null,
  job: null,
  interests: null,
  originGroup: null,
  joinedAt: new Date("2022-04-01"),
  deletedAt: null,
  phone: null,
  adminMemo: null,
  createdAt: new Date("2022-04-01"),
});

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", settingsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────
// GET /settings
// ────────────────────────────

describe("GET /settings", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings");
    expect(res.status).toBe(403);
  });

  it("finance: 200で{id, name, slug}を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings");
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ id: "org-1", name: "東京男声合唱団", slug: "tokyo-men-choir" });
  });

  it("admin: 200で取得できる", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings");
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────
// PATCH /settings
// ────────────────────────────

describe("PATCH /settings", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "新団体名" }),
    });
    expect(res.status).toBe(403);
  });

  it("admin: 200でname更新後の団体情報を返す", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValue({
      ...testOrg,
      name: "新団体名",
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "新団体名" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: "org-1", name: "新団体名", slug: "tokyo-men-choir" });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { name: "新団体名" },
    });
  });

  it("nameが空文字: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────
// GET /settings/org
// ────────────────────────────

describe("GET /settings/org", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/org");
    expect(res.status).toBe(403);
  });

  it("finance: 200で{feeType, defaultFeeAmount}を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/org");
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ feeType: "per_rehearsal", defaultFeeAmount: null });
  });

  it("admin: 200で取得できる", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/org");
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────
// PATCH /settings/fee
// ────────────────────────────

describe("PATCH /settings/fee", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeType: "monthly" }),
    });
    expect(res.status).toBe(403);
  });

  it("finance: 200で更新できる", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValue({
      ...testOrg,
      feeType: "monthly",
      defaultFeeAmount: 3000,
    });
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeType: "monthly", defaultFeeAmount: 3000 }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ feeType: "monthly", defaultFeeAmount: 3000 });
  });

  it("admin: 200で更新できる", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValue(testOrg);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeType: "per_rehearsal" }),
    });
    expect(res.status).toBe(200);
  });

  it("feeTypeのみの部分更新: defaultFeeAmountは更新データに含まれない", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValue({
      ...testOrg,
      feeType: "monthly",
    });
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeType: "monthly" }),
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { feeType: "monthly" },
    });
  });

  it("defaultFeeAmountのみの部分更新: feeTypeは更新データに含まれない", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValue({
      ...testOrg,
      defaultFeeAmount: 500,
    });
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultFeeAmount: 500 }),
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { defaultFeeAmount: 500 },
    });
  });

  it("feeTypeがenum外の値: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeType: "yearly" }),
    });
    expect(res.status).toBe(400);
  });

  it("defaultFeeAmountが負数: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultFeeAmount: -100 }),
    });
    expect(res.status).toBe(400);
  });
});
