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
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collectionPayment: { create: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    member: { findMany: vi.fn(), findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    score: { findUnique: vi.fn() },
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
  feeType: "per_rehearsal",
  defaultFeeAmount: null,
  visitorFormToken: null,
  visitorIntroSubjectTemplate: "見学者のご紹介",
  visitorIntroBodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
  visitorIntroLineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
  createdAt: new Date("2024-01-01"),
  deletedAt: null,
  deletedByEmail: null,
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
  calendarFeedToken: null,
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

  it("正常: yearに応じたsince/until範囲でクエリされる", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/summary?year=2025");

    const since = new Date("2025-01-01T00:00:00Z");
    const until = new Date("2026-01-01T00:00:00Z");
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: testOrg.id,
          OR: [{ paidAt: { gte: since, lt: until } }, { paidAt: null }],
        },
      }),
    );
    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id, createdAt: { gte: since, lt: until } },
      }),
    );
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

describe("POST /finance/expenses", () => {
  const validBody = { categoryId: "cat-1", title: "会場費", amount: 8000 };

  it("バリデーションエラー: amountが0以下は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, amount: 0 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("カテゴリが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("eventIdが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, eventId: "event-1" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 201を返す", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({
      id: "cat-1",
      orgId: "org-1",
      name: "会場費",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    });
    vi.mocked(prisma.expense.create).mockResolvedValue({
      id: "expense-1",
      title: "会場費",
      amount: 8000,
      paymentMethod: null,
      paidAt: null,
      eventId: null,
      note: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      category: { id: "cat-1", name: "会場費" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["finance"], "member-recorder"));
    const res = await app.request("/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.id).toBe("expense-1");
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: testOrg.id,
          categoryId: "cat-1",
          recordedById: "member-recorder",
        }),
      }),
    );
  });
});

describe("PATCH /finance/expenses/:expenseId", () => {
  it("バリデーションエラー: amountが0以下は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/expense-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 0 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/expenses/expense-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 5000 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("支出が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 5000 }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("categoryIdが存在しない/別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: "expense-1" } as any);
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/expense-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "other-org-cat" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it("eventIdが存在しない/別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: "expense-1" } as any);
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/expense-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: "other-org-event" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it("正常: 部分更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: "expense-1" } as any);
    vi.mocked(prisma.expense.update).mockResolvedValue({
      id: "expense-1",
      title: "会場費（改）",
      amount: 9000,
      paymentMethod: null,
      paidAt: null,
      eventId: null,
      note: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      category: { id: "cat-1", name: "会場費" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/expense-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "会場費（改）", amount: 9000 }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.title).toBe("会場費（改）");
    expect(body.data.amount).toBe(9000);
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "expense-1", orgId: testOrg.id },
        data: { title: "会場費（改）", amount: 9000 },
      }),
    );
  });
});

describe("DELETE /finance/expenses/:expenseId", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/expenses/expense-1", { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("支出が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/nonexistent", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: "expense-1" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.expense.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/expense-1", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.expense.delete).toHaveBeenCalledWith({
      where: { id: "expense-1", orgId: testOrg.id },
    });
  });
});

describe("GET /finance/collections", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: summaryが集計される", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([
      {
        id: "collection-1",
        title: "6月合宿費",
        amount: 1000,
        dueDate: null,
        eventId: null,
        yearMonth: null,
        note: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
        payments: [
          { status: "paid", amount: 1000 },
          { status: "paid", amount: null },
          { status: "pending", amount: null },
          { status: "waived", amount: null },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0].summary).toEqual({
      total: 4,
      paid: 2,
      pending: 1,
      waived: 1,
      paidAmount: 2000,
    });
  });

  it("正常: from/toで絞り込みされる", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/collections?from=2026-01-01&to=2026-12-31");

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: testOrg.id,
          createdAt: { gte: new Date("2026-01-01"), lte: new Date("2026-12-31") },
        }),
      }),
    );
  });

  it("徴収が0件: 空配列を返す", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("POST /finance/collections", () => {
  const validBody = { title: "6月合宿費", amount: 15000 };

  it("バリデーションエラー: amountが0以下は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, amount: 0 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("eventIdが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, eventId: "other-org-event" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it("scoreIdが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, scoreId: "other-org-score" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it("正常（memberIds未指定）: アクティブかつguest/visitor除くメンバー全員にpendingが作成される", async () => {
    vi.mocked(prisma.collection.create).mockResolvedValue({
      id: "collection-1",
      title: "6月合宿費",
      amount: 15000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-1", memberTypeId: null },
      { id: "member-2", memberTypeId: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collectionPayment.create).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: testOrg.id,
          status: "active",
          NOT: { roles: { hasSome: ["guest", "visitor"] } },
        }),
      }),
    );
    expect(prisma.collectionPayment.create).toHaveBeenCalledTimes(2);
    expect(prisma.collectionPayment.create).toHaveBeenCalledWith({
      data: { collectionId: "collection-1", memberId: "member-1", status: "pending", amount: null },
    });
  });

  it("正常（memberIds指定）: 指定メンバーのみに作成される", async () => {
    vi.mocked(prisma.collection.create).mockResolvedValue({
      id: "collection-1",
      title: "6月合宿費",
      amount: 15000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-1", memberTypeId: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collectionPayment.create).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, memberIds: ["member-1"] }),
    });

    expect(res.status).toBe(201);
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["member-1"] }, orgId: testOrg.id },
      }),
    );
    expect(prisma.collectionPayment.create).toHaveBeenCalledTimes(1);
  });

  it("正常（memberTypeAmounts指定）: 該当パート種別のみ個別金額が設定される", async () => {
    vi.mocked(prisma.collection.create).mockResolvedValue({
      id: "collection-1",
      title: "6月合宿費",
      amount: 15000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-1", memberTypeId: "type-student" },
      { id: "member-2", memberTypeId: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collectionPayment.create).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        memberIds: ["member-1", "member-2"],
        memberTypeAmounts: { "type-student": 8000 },
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.collectionPayment.create).toHaveBeenCalledWith({
      data: { collectionId: "collection-1", memberId: "member-1", status: "pending", amount: 8000 },
    });
    expect(prisma.collectionPayment.create).toHaveBeenCalledWith({
      data: { collectionId: "collection-1", memberId: "member-2", status: "pending", amount: null },
    });
  });

  it("正常: レスポンスは{id, title, amount}のみ", async () => {
    vi.mocked(prisma.collection.create).mockResolvedValue({
      id: "collection-1",
      title: "6月合宿費",
      amount: 15000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const body = await json(res);
    expect(body.data).toEqual({ id: "collection-1", title: "6月合宿費", amount: 15000 });
  });
});

describe("GET /finance/collections/:collectionId", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections/collection-1");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("徴収が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.collection.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: paymentsがmember情報込みで返る", async () => {
    vi.mocked(prisma.collection.findFirst).mockResolvedValue({
      id: "collection-1",
      title: "6月合宿費",
      amount: 15000,
      dueDate: null,
      eventId: null,
      yearMonth: null,
      note: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      payments: [
        {
          id: "payment-1",
          status: "paid",
          amount: 15000,
          paidAt: new Date("2026-06-10T00:00:00Z"),
          method: "cash",
          note: null,
          member: {
            id: "member-1",
            userRef: { nameJa: "山田 太郎" },
            part: { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
            memberType: { defaultFeeAmount: 5000 },
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.payments[0]).toEqual({
      id: "payment-1",
      member: {
        id: "member-1",
        nameJa: "山田 太郎",
        part: { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
        memberTypeFee: 5000,
      },
      status: "paid",
      amount: 15000,
      paidAt: "2026-06-10T00:00:00.000Z",
      method: "cash",
      note: null,
    });
  });
});

describe("PATCH /finance/collections/:collectionId", () => {
  it("バリデーションエラー: amountが0以下は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 0 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections/collection-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("徴収が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.collection.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("eventIdが存在しない/別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findFirst).mockResolvedValue({ id: "collection-1" } as any);
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: "other-org-event" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.collection.update).not.toHaveBeenCalled();
  });

  it("正常: 部分更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findFirst).mockResolvedValue({ id: "collection-1" } as any);
    vi.mocked(prisma.collection.update).mockResolvedValue({
      id: "collection-1",
      title: "6月合宿費（改）",
      amount: 16000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "6月合宿費（改）", amount: 16000 }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: "collection-1", title: "6月合宿費（改）", amount: 16000 });
    expect(prisma.collection.update).toHaveBeenCalledWith({
      where: { id: "collection-1", orgId: testOrg.id },
      data: { title: "6月合宿費（改）", amount: 16000 },
    });
  });
});

describe("DELETE /finance/collections/:collectionId", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections/collection-1", { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("徴収が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.collection.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/nonexistent", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（financeロールでも削除できる）: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findFirst).mockResolvedValue({ id: "collection-1" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.collection.delete).toHaveBeenCalledWith({
      where: { id: "collection-1", orgId: testOrg.id },
    });
  });
});

describe("PATCH /finance/collections/:collectionId/payments/:memberId", () => {
  const testCollection = { id: "collection-1", orgId: "org-1", amount: 300 };

  it("バリデーションエラー: statusが不正な値は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1/payments/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections/collection-1/payments/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("徴収が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/nonexistent/payments/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("メンバーが存在しない/別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(testCollection as any);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1/payments/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（新規作成）: upsertのcreateが呼ばれる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(testCollection as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ orgId: "org-1" } as any);
    vi.mocked(prisma.collectionPayment.upsert).mockResolvedValue({
      id: "payment-1",
      status: "paid",
      amount: 300,
      paidAt: new Date("2026-06-14T00:00:00Z"),
      method: "cash",
      note: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const actingMember = makeMember(["finance"], "recorder-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/finance/collections/collection-1/payments/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", amount: 300, paidAt: "2026-06-14", method: "cash" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.status).toBe("paid");
    expect(prisma.collectionPayment.upsert).toHaveBeenCalledWith({
      where: { collectionId_memberId: { collectionId: "collection-1", memberId: "member-2" } },
      create: {
        collectionId: "collection-1",
        memberId: "member-2",
        status: "paid",
        amount: 300,
        paidAt: new Date("2026-06-14"),
        method: "cash",
        note: null,
        recordedById: actingMember.id,
      },
      update: {
        status: "paid",
        amount: 300,
        paidAt: new Date("2026-06-14"),
        method: "cash",
        note: null,
        recordedById: actingMember.id,
      },
    });
  });

  it("正常（既存更新）: statusのみ変更してもupsertが呼ばれる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(testCollection as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ orgId: "org-1" } as any);
    vi.mocked(prisma.collectionPayment.upsert).mockResolvedValue({
      id: "payment-1",
      status: "waived",
      amount: null,
      paidAt: null,
      method: null,
      note: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["finance"], "recorder-1"));
    const res = await app.request("/finance/collections/collection-1/payments/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "waived" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.status).toBe("waived");
    expect(body.data.amount).toBeNull();
  });
});

describe("POST /finance/collections/:collectionId/payments/bulk", () => {
  const testCollection = { id: "collection-1", orgId: "org-1", amount: 300 };

  it("バリデーションエラー: memberIdsが空配列は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [], status: "paid" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections/collection-1/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: ["member-2"], status: "paid" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("徴収が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/nonexistent/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: ["member-2"], status: "paid" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("別テナントのメンバーIDが含まれる: 400 BAD_REQUESTを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(testCollection as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([{ id: "member-2" }] as any);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/collection-1/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: ["member-2", "other-org-member"], status: "paid" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("正常: 複数メンバーが一括更新されamountは更新対象外", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(testCollection as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-2" },
      { id: "member-3" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collectionPayment.upsert).mockResolvedValue({} as any);

    const actingMember = makeMember(["finance"], "recorder-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/finance/collections/collection-1/payments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberIds: ["member-2", "member-3"],
        status: "paid",
        paidAt: "2026-06-14T00:00:00+09:00",
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ updated: 2 });
    expect(prisma.collectionPayment.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.collectionPayment.upsert).toHaveBeenCalledWith({
      where: { collectionId_memberId: { collectionId: "collection-1", memberId: "member-2" } },
      create: {
        collectionId: "collection-1",
        memberId: "member-2",
        status: "paid",
        paidAt: new Date("2026-06-14T00:00:00+09:00"),
        method: null,
        recordedById: actingMember.id,
      },
      update: {
        status: "paid",
        paidAt: new Date("2026-06-14T00:00:00+09:00"),
        method: null,
        recordedById: actingMember.id,
      },
    });
  });
});

const YEAR_2026 = { gte: new Date("2026-01-01T00:00:00Z"), lt: new Date("2027-01-01T00:00:00Z") };

function csvLines(text: string): string[] {
  return text.replace(/^\uFEFF/, "").split("\r\n");
}

describe("GET /finance/expenses/export", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/expenses/export");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: 支出をCSVで返す", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: "exp-1",
        title: "会場費",
        amount: 12000,
        paymentMethod: "bank_transfer",
        paidAt: new Date("2026-04-10"),
        note: "4月分",
        createdAt: new Date("2026-04-11T01:00:00Z"),
        category: { name: "会場費" },
        event: { title: "4月練習" },
      },
      {
        id: "exp-2",
        title: '=HYPERLINK("x")',
        amount: 500,
        paymentMethod: null,
        paidAt: null,
        note: null,
        createdAt: new Date("2026-04-12T01:00:00Z"),
        category: { name: "その他" },
        event: null,
      },
    ] as never);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/export");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("expenses_");
    const lines = csvLines(await res.text());
    expect(lines[0]).toBe("支払日,カテゴリ,件名,金額,支払方法,関連イベント,メモ,登録日時");
    expect(lines[1]).toBe("2026-04-10,会場費,会場費,12000,振込,4月練習,4月分,2026-04-11 10:00");
    expect(lines[2]).toBe(`,その他,"'=HYPERLINK(""x"")",500,,,,2026-04-12 10:00`);
  });

  it("正常: 指定年度で絞り込み、支払日未設定の支出も含め、ファイル名に年度を付ける", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/export?year=2026");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("expenses_2026_");
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id, OR: [{ paidAt: YEAR_2026 }, { paidAt: null }] },
      }),
    );
    expect(csvLines(await res.text())).toEqual([
      "支払日,カテゴリ,件名,金額,支払方法,関連イベント,メモ,登録日時",
      "",
    ]);
  });

  it("year未指定: 今年を対象にする", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    const year = new Date().getFullYear();

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/export");

    expect(res.headers.get("Content-Disposition")).toContain(`expenses_${year}_`);
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: testOrg.id,
          OR: [
            {
              paidAt: {
                gte: new Date(`${year}-01-01T00:00:00Z`),
                lt: new Date(`${year + 1}-01-01T00:00:00Z`),
              },
            },
            { paidAt: null },
          ],
        },
      }),
    );
  });

  it("バリデーションエラー: yearが4桁でない場合は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/expenses/export?year=26");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /finance/collections/export", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/collections/export");

    expect(res.status).toBe(403);
  });

  it("正常: 徴収ごとの集計をCSVで返す（作成日はJST・個別金額を優先して支払済額を合計）", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([
      {
        id: "col-1",
        title: "4月団費",
        amount: 3000,
        yearMonth: "2026-04",
        dueDate: new Date("2026-04-30"),
        note: null,
        createdAt: new Date("2026-03-31T15:30:00Z"),
        payments: [
          { status: "paid", amount: null },
          { status: "paid", amount: 1500 },
          { status: "pending", amount: null },
          { status: "waived", amount: null },
        ],
      },
    ] as never);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/finance/collections/export");

    expect(res.status).toBe(200);
    expect(prisma.collection.findFirst).not.toHaveBeenCalled();
    const lines = csvLines(await res.text());
    expect(lines[0]).toBe(
      "作成日,徴収名,対象年月,締切日,金額,対象人数,支払済,未払い,免除,支払済額,メモ",
    );
    expect(lines[1]).toBe("2026-04-01,4月団費,2026-04,2026-04-30,3000,4,2,1,1,4500,");
  });
});

describe("GET /finance/collections/export（年度）", () => {
  it("指定年度の作成日で絞り込み、ファイル名に年度を付ける", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/export?year=2026");

    expect(res.headers.get("Content-Disposition")).toContain("collections_2026_");
    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id, createdAt: YEAR_2026 } }),
    );
  });

  it("バリデーションエラー: yearが4桁でない場合は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/collections/export?year=abcd");

    expect(res.status).toBe(400);
    expect(prisma.collection.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /finance/payments/export", () => {
  it("会計担当者未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/finance/payments/export");

    expect(res.status).toBe(403);
  });

  it("正常: 団員別の納入状況をCSVで返す", async () => {
    const collection = {
      title: "4月団費",
      amount: 3000,
      yearMonth: "2026-04",
      dueDate: null,
    };
    vi.mocked(prisma.collectionPayment.findMany).mockResolvedValue([
      {
        status: "paid",
        amount: null,
        paidAt: new Date("2026-04-15"),
        method: "paypay",
        note: null,
        collection,
        member: { userRef: { nameJa: "山田 太郎" }, part: { name: "Tenor I" } },
      },
      {
        status: "pending",
        amount: 1500,
        paidAt: null,
        method: null,
        note: "学生割",
        collection,
        member: { userRef: { nameJa: "佐藤 次郎" }, part: null },
      },
    ] as never);

    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/payments/export?year=2026");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("collection_payments_2026_");
    expect(prisma.collectionPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collection: { orgId: testOrg.id, createdAt: YEAR_2026 } },
      }),
    );
    const lines = csvLines(await res.text());
    expect(lines[0]).toBe("徴収名,対象年月,締切日,氏名,パート,状態,金額,支払日,支払方法,メモ");
    expect(lines[1]).toBe("4月団費,2026-04,,山田 太郎,Tenor I,支払済,3000,2026-04-15,PayPay,");
    expect(lines[2]).toBe("4月団費,2026-04,,佐藤 次郎,,未払い,1500,,,学生割");
  });
});

describe("GET /finance/payments/export（バリデーション）", () => {
  it("yearが4桁でない場合は400を返す", async () => {
    const app = createTestApp(makeMember(["finance"]));
    const res = await app.request("/finance/payments/export?year=2026-04");

    expect(res.status).toBe(400);
    expect(prisma.collectionPayment.findMany).not.toHaveBeenCalled();
  });
});

describe("CSVエクスポート（並び順）", () => {
  it("支出: 支払日の昇順（未設定は末尾）→登録日時順", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/expenses/export");
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ paidAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      }),
    );
  });

  it("徴収一覧: 作成日の昇順", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/collections/export");
    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
  });

  it("支払い状況: 徴収作成日→パート順→ふりがな順", async () => {
    vi.mocked(prisma.collectionPayment.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["finance"]));
    await app.request("/finance/payments/export");
    expect(prisma.collectionPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { collection: { createdAt: "asc" } },
          { member: { part: { sortOrder: "asc" } } },
          { member: { userRef: { nameKana: "asc" } } },
        ],
      }),
    );
  });
});
