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
    part: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    member: { count: vi.fn() },
    expenseCategory: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    expense: { count: vi.fn() },
    memberType: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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

// ────────────────────────────
// POST /parts
// ────────────────────────────

describe("POST /parts", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Baritone", voiceType: "baritone" }),
    });
    expect(res.status).toBe(403);
  });

  it("admin: 201でパートを作成する（sortOrderは既存最大値+1）", async () => {
    vi.mocked(prisma.part.aggregate).mockResolvedValue({ _max: { sortOrder: 3 } } as never);
    vi.mocked(prisma.part.create).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Baritone",
      voiceType: "baritone",
      sortOrder: 4,
      isCustom: true,
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Baritone", voiceType: "baritone" }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "part-1",
      name: "Baritone",
      voiceType: "baritone",
      sortOrder: 4,
    });
    expect(prisma.part.create).toHaveBeenCalledWith({
      data: {
        orgId: "org-1",
        name: "Baritone",
        voiceType: "baritone",
        sortOrder: 4,
        isCustom: true,
      },
    });
  });

  it("voiceType省略時: デフォルト値otherで作成される", async () => {
    vi.mocked(prisma.part.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
    vi.mocked(prisma.part.create).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "混声",
      voiceType: "other",
      sortOrder: 1,
      isCustom: true,
    });
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "混声" }),
    });
    expect(prisma.part.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "混声", voiceType: "other", sortOrder: 1, isCustom: true },
    });
  });

  it("nameが空文字: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────
// PATCH /parts/:partId
// ────────────────────────────

describe("PATCH /parts/:partId", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/parts/part-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tenor II" }),
    });
    expect(res.status).toBe(403);
  });

  it("存在しないpartId: 404を返す", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/no-such-part", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tenor II" }),
    });
    expect(res.status).toBe(404);
  });

  it("他テナントのpartId: 404を返す", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-other",
      orgId: "org-2",
      name: "Alto",
      voiceType: "alto",
      sortOrder: 1,
      isCustom: true,
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/part-other", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tenor II" }),
    });
    expect(res.status).toBe(404);
  });

  it("admin: 200でname・sortOrderを部分更新できる", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Tenor I",
      voiceType: "tenor",
      sortOrder: 1,
      isCustom: true,
    });
    vi.mocked(prisma.part.update).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Tenor II",
      voiceType: "tenor",
      sortOrder: 2,
      isCustom: true,
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/part-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tenor II", sortOrder: 2 }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "part-1",
      name: "Tenor II",
      voiceType: "tenor",
      sortOrder: 2,
    });
    expect(prisma.part.update).toHaveBeenCalledWith({
      where: { id: "part-1" },
      data: { name: "Tenor II", sortOrder: 2 },
    });
  });
});

// ────────────────────────────
// DELETE /parts/:partId
// ────────────────────────────

describe("DELETE /parts/:partId", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/parts/part-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("存在しないpartId: 404を返す", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/no-such-part", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("他テナントのpartId: 404を返す", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-other",
      orgId: "org-2",
      name: "Alto",
      voiceType: "alto",
      sortOrder: 1,
      isCustom: true,
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/part-other", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("デフォルトパート(isCustom: false): 409を返す", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Tenor I",
      voiceType: "tenor",
      sortOrder: 1,
      isCustom: false,
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/part-1", { method: "DELETE" });
    expect(res.status).toBe(409);
    expect(prisma.member.count).not.toHaveBeenCalled();
  });

  it("在団メンバーが所属している: 409を返す", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Baritone",
      voiceType: "baritone",
      sortOrder: 2,
      isCustom: true,
    });
    vi.mocked(prisma.member.count).mockResolvedValue(2);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/part-1", { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  it("カスタムパートかつ在団メンバー0人: 204で削除できる", async () => {
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Baritone",
      voiceType: "baritone",
      sortOrder: 2,
      isCustom: true,
    });
    vi.mocked(prisma.member.count).mockResolvedValue(0);
    vi.mocked(prisma.part.delete).mockResolvedValue({
      id: "part-1",
      orgId: "org-1",
      name: "Baritone",
      voiceType: "baritone",
      sortOrder: 2,
      isCustom: true,
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/parts/part-1", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(prisma.part.delete).toHaveBeenCalledWith({ where: { id: "part-1" } });
  });
});

// ────────────────────────────
// GET /settings/expense-categories
// ────────────────────────────

describe("GET /settings/expense-categories", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/expense-categories");
    expect(res.status).toBe(403);
  });

  it("finance: 200で一覧を取得できる", async () => {
    vi.mocked(prisma.expenseCategory.findMany).mockResolvedValue([
      {
        id: "cat-1",
        orgId: "org-1",
        name: "会場費",
        sortOrder: 0,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "cat-2",
        orgId: "org-1",
        name: "指導者謝礼",
        sortOrder: 1,
        createdAt: new Date("2024-01-01"),
      },
    ]);
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      { id: "cat-1", name: "会場費", sortOrder: 0 },
      { id: "cat-2", name: "指導者謝礼", sortOrder: 1 },
    ]);
    expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { sortOrder: "asc" },
    });
  });
});

// ────────────────────────────
// POST /settings/expense-categories
// ────────────────────────────

describe("POST /settings/expense-categories", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "合宿費" }),
    });
    expect(res.status).toBe(403);
  });

  it("finance: 201で作成する（sortOrder省略時は既存最大値+1）", async () => {
    vi.mocked(prisma.expenseCategory.aggregate).mockResolvedValue({
      _max: { sortOrder: 2 },
    } as never);
    vi.mocked(prisma.expenseCategory.create).mockResolvedValue({
      id: "cat-3",
      orgId: "org-1",
      name: "合宿費",
      sortOrder: 3,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "合宿費" }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({ id: "cat-3", name: "合宿費", sortOrder: 3 });
    expect(prisma.expenseCategory.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "合宿費", sortOrder: 3 },
    });
  });

  it("sortOrder明示指定時: 既存最大値を無視して指定値をそのまま使う", async () => {
    vi.mocked(prisma.expenseCategory.aggregate).mockResolvedValue({
      _max: { sortOrder: 99 },
    } as never);
    vi.mocked(prisma.expenseCategory.create).mockResolvedValue({
      id: "cat-3",
      orgId: "org-1",
      name: "合宿費",
      sortOrder: 10,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/settings/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "合宿費", sortOrder: 10 }),
    });
    expect(prisma.expenseCategory.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "合宿費", sortOrder: 10 },
    });
  });

  it("nameが空文字: 400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("nameが51文字以上: 400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "あ".repeat(51) }),
    });
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────
// PATCH /settings/expense-categories/:categoryId
// ────────────────────────────

describe("PATCH /settings/expense-categories/:categoryId", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/expense-categories/cat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "会場・設営費" }),
    });
    expect(res.status).toBe(403);
  });

  it("存在しないcategoryId: 404を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/no-such-cat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "会場・設営費" }),
    });
    expect(res.status).toBe(404);
  });

  it("他テナントのcategoryId: 404を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-other",
      orgId: "org-2",
      name: "他団体費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/cat-other", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "会場・設営費" }),
    });
    expect(res.status).toBe(404);
  });

  it("finance: 200でname・sortOrderを部分更新できる", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.expenseCategory.update).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場・設営費",
      sortOrder: 3,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/cat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "会場・設営費", sortOrder: 3 }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: "cat-1", name: "会場・設営費", sortOrder: 3 });
    expect(prisma.expenseCategory.update).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { name: "会場・設営費", sortOrder: 3 },
    });
  });
});

// ────────────────────────────
// DELETE /settings/expense-categories/:categoryId
// ────────────────────────────

describe("DELETE /settings/expense-categories/:categoryId", () => {
  it("finance未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/expense-categories/cat-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("存在しないcategoryId: 404を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/no-such-cat", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("他テナントのcategoryId: 404を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-other",
      orgId: "org-2",
      name: "他団体費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/cat-other", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("紐付くExpenseが存在する: 409を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.expense.count).mockResolvedValue(3);
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/cat-1", { method: "DELETE" });
    expect(res.status).toBe(409);
    expect(prisma.expenseCategory.delete).not.toHaveBeenCalled();
  });

  it("紐付くExpenseが0件: 204で削除できる", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expenseCategory.delete).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/settings/expense-categories/cat-1", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(prisma.expenseCategory.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
  });
});

// ────────────────────────────
// GET /settings/member-types
// ────────────────────────────

describe("GET /settings/member-types", () => {
  it("member未満(guest): 403を返す", async () => {
    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request("/settings/member-types");
    expect(res.status).toBe(403);
  });

  it("member: 200で一覧を取得できる", async () => {
    vi.mocked(prisma.memberType.findMany).mockResolvedValue([
      {
        id: "type-1",
        orgId: "org-1",
        name: "正団員",
        defaultFeeAmount: 3000,
        sortOrder: 0,
        createdAt: new Date("2024-01-01"),
      },
    ]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/member-types");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      { id: "type-1", name: "正団員", defaultFeeAmount: 3000, sortOrder: 0 },
    ]);
    expect(prisma.memberType.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { sortOrder: "asc" },
    });
  });
});

// ────────────────────────────
// POST /settings/member-types
// ────────────────────────────

describe("POST /settings/member-types", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/member-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB" }),
    });
    expect(res.status).toBe(403);
  });

  it("admin: 201で作成する（sortOrder省略時は既存最大値+1）", async () => {
    vi.mocked(prisma.memberType.aggregate).mockResolvedValue({ _max: { sortOrder: 0 } } as never);
    vi.mocked(prisma.memberType.create).mockResolvedValue({
      id: "type-2",
      orgId: "org-1",
      name: "OB",
      defaultFeeAmount: 1000,
      sortOrder: 1,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB", defaultFeeAmount: 1000 }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "type-2",
      name: "OB",
      defaultFeeAmount: 1000,
      sortOrder: 1,
    });
    expect(prisma.memberType.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "OB", defaultFeeAmount: 1000, sortOrder: 1 },
    });
  });

  it("defaultFeeAmount省略時: nullで作成される", async () => {
    vi.mocked(prisma.memberType.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(prisma.memberType.create).mockResolvedValue({
      id: "type-2",
      orgId: "org-1",
      name: "OB",
      defaultFeeAmount: null,
      sortOrder: 1,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/settings/member-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB" }),
    });
    expect(prisma.memberType.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "OB", defaultFeeAmount: null, sortOrder: 1 },
    });
  });

  it("nameが空文字: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("nameが51文字以上: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "あ".repeat(51) }),
    });
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────
// PATCH /settings/member-types/:typeId
// ────────────────────────────

describe("PATCH /settings/member-types/:typeId", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/member-types/type-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB" }),
    });
    expect(res.status).toBe(403);
  });

  it("存在しないtypeId: 404を返す", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/no-such-type", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB" }),
    });
    expect(res.status).toBe(404);
  });

  it("他テナントのtypeId: 404を返す", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue({
      id: "type-other",
      orgId: "org-2",
      name: "他団体区分",
      defaultFeeAmount: null,
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/type-other", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB" }),
    });
    expect(res.status).toBe(404);
  });

  it("admin: 200でname・defaultFeeAmount・sortOrderを部分更新できる", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue({
      id: "type-1",
      orgId: "org-1",
      name: "正団員",
      defaultFeeAmount: 3000,
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.memberType.update).mockResolvedValue({
      id: "type-1",
      orgId: "org-1",
      name: "OB",
      defaultFeeAmount: 1000,
      sortOrder: 1,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/type-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OB", defaultFeeAmount: 1000, sortOrder: 1 }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "type-1",
      name: "OB",
      defaultFeeAmount: 1000,
      sortOrder: 1,
    });
    expect(prisma.memberType.update).toHaveBeenCalledWith({
      where: { id: "type-1" },
      data: { name: "OB", defaultFeeAmount: 1000, sortOrder: 1 },
    });
  });
});

// ────────────────────────────
// DELETE /settings/member-types/:typeId
// ────────────────────────────

describe("DELETE /settings/member-types/:typeId", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/settings/member-types/type-1", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("存在しないtypeId: 404を返す", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/no-such-type", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("他テナントのtypeId: 404を返す", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue({
      id: "type-other",
      orgId: "org-2",
      name: "他団体区分",
      defaultFeeAmount: null,
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/type-other", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("使用中のメンバーが存在する: 409を返す（人数を含むメッセージ）", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue({
      id: "type-1",
      orgId: "org-1",
      name: "正団員",
      defaultFeeAmount: 3000,
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.member.count).mockResolvedValue(5);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/type-1", { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.message).toContain("5");
    expect(prisma.memberType.delete).not.toHaveBeenCalled();
  });

  it("使用中のメンバーが0人: 204で削除できる", async () => {
    vi.mocked(prisma.memberType.findUnique).mockResolvedValue({
      id: "type-1",
      orgId: "org-1",
      name: "正団員",
      defaultFeeAmount: 3000,
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.member.count).mockResolvedValue(0);
    vi.mocked(prisma.memberType.delete).mockResolvedValue({
      id: "type-1",
      orgId: "org-1",
      name: "正団員",
      defaultFeeAmount: 3000,
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/settings/member-types/type-1", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(prisma.memberType.delete).toHaveBeenCalledWith({ where: { id: "type-1" } });
  });
});
