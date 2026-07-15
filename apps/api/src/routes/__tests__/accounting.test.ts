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
    expense: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    expenseCategory: { findUnique: vi.fn() },
    collection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collectionPayment: { create: vi.fn(), upsert: vi.fn() },
    member: { findMany: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { accountingRouter } from "../accounting.js";

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
  app.route("/", accountingRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /finance/summary", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/summary");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("バリデーションエラー: yearが4桁でないは400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/summary?year=26");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("正常: waivedは集計に含まれない", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([
      {
        amount: 1000,
        payments: [
          { status: "paid", amount: 1000 },
          { status: "pending", amount: 1000 },
          { status: "waived", amount: 1000 },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/summary?year=2026");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.totalCollected).toBe(1000);
    expect(body.data.totalPending).toBe(1000);
    expect(body.data.balance).toBe(1000);
  });

  it("正常: カテゴリ別支出が集計される", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        categoryId: "cat-1",
        amount: 5000,
        category: { name: "会場費" },
      },
      {
        categoryId: "cat-1",
        amount: 3000,
        category: { name: "会場費" },
      },
      {
        categoryId: "cat-2",
        amount: 2000,
        category: { name: "楽譜代" },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/summary?year=2026");

    const body = await json(res);
    expect(body.data.totalExpense).toBe(10000);
    expect(body.data.expenseByCategory).toEqual([
      { categoryId: "cat-1", name: "会場費", total: 8000 },
      { categoryId: "cat-2", name: "楽譜代", total: 2000 },
    ]);
  });

  it("正常: year省略時は当年になる", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/finance/summary");

    const body = await json(res);
    expect(body.data.year).toBe(new Date().getFullYear());
  });
});

describe("GET /finance/expenses", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/expenses");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: from/toで絞り込み、paidAt:nullの支出は常に含まれる", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/expenses?from=2026-01-01&to=2026-12-31");

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: testOrg.id,
          OR: [
            { paidAt: { gte: new Date("2026-01-01"), lte: new Date("2026-12-31") } },
            { paidAt: null },
          ],
        }),
      }),
    );
  });

  it("正常: categoryIdで絞り込みされる", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/expenses?categoryId=cat-1");

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: testOrg.id, categoryId: "cat-1" }),
      }),
    );
  });

  it("支出が0件: 空配列を返す", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});
