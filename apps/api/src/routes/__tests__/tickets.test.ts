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
    concert: { findMany: vi.fn(), findUnique: vi.fn() },
    ticketAllocation: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    ticketBatch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    part: { findMany: vi.fn() },
    member: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { ticketsRouter } from "../tickets.js";

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

const testConcert = {
  id: "concert-1",
  orgId: "org-1",
  title: "第20回定期演奏会",
  heldOn: new Date("2026-11-23T00:00:00Z"),
  venue: "○○ホール",
  status: "confirmed",
  ticketInputClosedAt: null,
  outreachExpensePerTrip: null,
};

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", ticketsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /tickets", () => {
  it("ticket担当者/admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/tickets");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: soldRateが計算される（allocated>0）", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: new Date("2026-11-23T00:00:00Z"),
        status: "confirmed",
        ticketBatches: [
          {
            allocations: [
              {
                allocatedCount: 10,
                soldAdult: 5,
                soldStudent: 2,
                soldOther: 0,
                isCollected: true,
              },
              {
                allocatedCount: 10,
                soldAdult: 0,
                soldStudent: 0,
                soldOther: 0,
                isCollected: false,
              },
            ],
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request("/tickets");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0]).toEqual({
      concertId: "concert-1",
      title: "第20回定期演奏会",
      heldOn: "2026-11-23T00:00:00.000Z",
      status: "confirmed",
      batchCount: 1,
      totalAllocated: 20,
      totalSold: 7,
      soldRate: 0.35,
      collectedCount: 1,
      memberCount: 2,
    });
  });

  it("正常: allocatedが0件の場合soldRateは0", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: new Date("2026-11-23T00:00:00Z"),
        status: "draft",
        ticketBatches: [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/tickets");

    const body = await json(res);
    expect(body.data[0].soldRate).toBe(0);
  });

  it("演奏会が0件: 空配列を返す", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/tickets");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("GET /tickets/my", () => {
  it("正常: 演奏会ごとにグループ化される", async () => {
    vi.mocked(prisma.ticketAllocation.findMany).mockResolvedValue([
      {
        id: "allocation-1",
        allocatedCount: 10,
        requestedCount: null,
        soldAdult: 5,
        soldStudent: 0,
        soldOther: 0,
        returnedCount: 0,
        outreachCount: 2,
        reportedAt: null,
        batch: {
          id: "batch-1",
          concertId: "concert-1",
          name: "一般",
          price: 2000,
          priceStudent: 1000,
          concert: {
            id: "concert-1",
            orgId: "org-1",
            title: "第20回定期演奏会",
            heldOn: new Date("2026-11-23T00:00:00Z"),
            racePublishedAt: null,
            ticketInputClosedAt: null,
          },
        },
      },
      {
        id: "allocation-2",
        allocatedCount: 5,
        requestedCount: null,
        soldAdult: 1,
        soldStudent: 0,
        soldOther: 0,
        returnedCount: 0,
        outreachCount: 0,
        reportedAt: null,
        batch: {
          id: "batch-2",
          concertId: "concert-1",
          name: "学生",
          price: 1000,
          priceStudent: null,
          concert: {
            id: "concert-1",
            orgId: "org-1",
            title: "第20回定期演奏会",
            heldOn: new Date("2026-11-23T00:00:00Z"),
            racePublishedAt: null,
            ticketInputClosedAt: null,
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/my");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].concertId).toBe("concert-1");
    expect(body.data[0].batches).toHaveLength(2);
    expect(body.data[0].batches.map((b: { batchName: string }) => b.batchName)).toEqual([
      "一般",
      "学生",
    ]);
  });

  it("正常: 他テナントのallocationは除外される", async () => {
    vi.mocked(prisma.ticketAllocation.findMany).mockResolvedValue([
      {
        id: "allocation-1",
        allocatedCount: 10,
        requestedCount: null,
        soldAdult: 0,
        soldStudent: 0,
        soldOther: 0,
        returnedCount: 0,
        outreachCount: 0,
        reportedAt: null,
        batch: {
          id: "batch-1",
          concertId: "concert-other",
          name: "一般",
          price: 2000,
          priceStudent: null,
          concert: {
            id: "concert-other",
            orgId: "other-org",
            title: "他団体の演奏会",
            heldOn: new Date("2026-11-23T00:00:00Z"),
            racePublishedAt: null,
            ticketInputClosedAt: null,
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/my");

    const body = await json(res);
    expect(body.data).toEqual([]);
  });

  it("allocationが0件: 空配列を返す", async () => {
    vi.mocked(prisma.ticketAllocation.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/tickets/my");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("GET /tickets/:concertId", () => {
  it("ticket担当者/admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/tickets/${testConcert.id}`);

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request("/tickets/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: guest/visitorのallocationは除外するクエリになっている", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["ticket"]));
    await app.request(`/tickets/${testConcert.id}`);

    expect(prisma.ticketBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          allocations: expect.objectContaining({
            where: { member: { NOT: { roles: { hasSome: ["guest", "visitor"] } } } },
          }),
        }),
      }),
    );
  });

  it("正常: partSummaryは割当0件のパートを除外する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.findMany).mockResolvedValue([
      {
        id: "batch-1",
        name: "一般",
        price: 2000,
        priceStudent: null,
        totalCount: 100,
        saleStart: null,
        saleEnd: null,
        allocations: [
          {
            id: "allocation-1",
            memberId: "member-1",
            allocatedCount: 10,
            requestedCount: null,
            soldAdult: 5,
            soldStudent: 0,
            soldOther: 0,
            returnedCount: 0,
            outreachCount: 0,
            isOutreachExpensePaid: false,
            outreachExpensePaidAt: null,
            isCollected: false,
            reportedAt: null,
            member: {
              userRef: { nameJa: "山田 太郎" },
              part: { id: "part-1", name: "Tenor I", sortOrder: 1, voiceType: "tenor" },
            },
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.part.findMany).mockResolvedValue([
      { id: "part-1", orgId: "org-1", name: "Tenor I", sortOrder: 1 },
      { id: "part-2", orgId: "org-1", name: "Bass I", sortOrder: 2 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}`);

    const body = await json(res);
    expect(body.data.partSummary).toEqual([
      { partId: "part-1", partName: "Tenor I", allocated: 10, sold: 5, rate: 0.5 },
    ]);
  });

  it("正常: myMemberIdが正しく返る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const actingMember = makeMember(["ticket"], "member-9");
    const app = createTestApp(actingMember);
    const res = await app.request(`/tickets/${testConcert.id}`);

    const body = await json(res);
    expect(body.data.myMemberId).toBe("member-9");
  });

  it("正常: isAdminはticketロールのみのメンバーでもtrueになる（isTicketManager基準）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["ticket"], "member-9"));
    const res = await app.request(`/tickets/${testConcert.id}`);

    const body = await json(res);
    expect(body.data.isAdmin).toBe(true);
  });

  it("正常: isAdminはadminロールのメンバーでもtrueになる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["admin"], "member-9"));
    const res = await app.request(`/tickets/${testConcert.id}`);

    const body = await json(res);
    expect(body.data.isAdmin).toBe(true);
  });

  it("正常: outreachExpensePerTripがnullの場合もnullとして返る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}`);

    const body = await json(res);
    expect(body.data.concert.outreachExpensePerTrip).toBeNull();
  });
});

describe("POST /tickets/:concertId/batches", () => {
  it("バリデーションエラー: totalCountが0以下は400を返す", async () => {
    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "一般", price: 2000, totalCount: 0 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ticket担当者/admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "一般", price: 2000, totalCount: 200 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request("/tickets/nonexistent/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "一般", price: 2000, totalCount: 200 }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 201を返しallocationsは空配列", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.ticketBatch.create).mockResolvedValue({
      id: "batch-1",
      name: "一般",
      price: 2000,
      priceStudent: null,
      totalCount: 200,
      saleStart: null,
      saleEnd: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "一般", price: 2000, totalCount: 200 }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "batch-1",
      name: "一般",
      price: 2000,
      priceStudent: null,
      totalCount: 200,
      saleStart: null,
      saleEnd: null,
      allocations: [],
    });
  });
});

describe("PATCH /tickets/:concertId/batches/:batchId", () => {
  const testBatch = {
    id: "batch-1",
    concertId: "concert-1",
    name: "一般",
    price: 2000,
    priceStudent: null,
    totalCount: 200,
    saleStart: null,
    saleEnd: null,
    concert: testConcert,
  };

  it("バリデーションエラー: priceが負数は400を返す", async () => {
    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/batch-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: -100 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ticket担当者/admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/batch-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("席種が存在しない/別演奏会・別テナント: 404を返す", async () => {
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/nonexistent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 部分更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(testBatch as any);
    vi.mocked(prisma.ticketBatch.update).mockResolvedValue({
      ...testBatch,
      name: "一般（改）",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/batch-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "一般（改）" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.name).toBe("一般（改）");
    expect(prisma.ticketBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: { name: "一般（改）" },
    });
  });
});

describe("DELETE /tickets/:concertId/batches/:batchId", () => {
  const testBatch = {
    id: "batch-1",
    concertId: "concert-1",
    name: "一般",
    concert: testConcert,
  };

  it("ticket担当者/admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/batch-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("席種が存在しない/別演奏会・別テナント: 404を返す", async () => {
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/nonexistent`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(testBatch as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/batches/batch-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(prisma.ticketBatch.delete).toHaveBeenCalledWith({ where: { id: "batch-1" } });
  });
});

describe("POST /tickets/:concertId/allocate", () => {
  const openBatch = {
    id: "batch-1",
    concertId: "concert-1",
    concert: { ...testConcert, ticketInputClosedAt: null },
  };
  const closedBatch = {
    id: "batch-1",
    concertId: "concert-1",
    concert: { ...testConcert, ticketInputClosedAt: new Date("2020-01-01T00:00:00Z") },
  };

  it("バリデーションエラー: allocatedCountが負数は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "batch-1", allocatedCount: -1 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("他メンバーへの登録を一般団員が試みる: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "batch-1", memberId: "member-2", allocatedCount: 10 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("席種が存在しない/別演奏会・別テナント: 404を返す", async () => {
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "nonexistent", memberId: "member-2", allocatedCount: 10 }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("締切後・非担当者が自分の申請: 403 INPUT_CLOSEDを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(closedBatch as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "batch-1", allocatedCount: 5 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("INPUT_CLOSED");
  });

  it("正常（ticket担当者が他者へ登録）: allocatedCountが確定しrequestedCountはnullになる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(openBatch as any);
    vi.mocked(prisma.ticketAllocation.upsert).mockResolvedValue({
      id: "allocation-1",
      batchId: "batch-1",
      memberId: "member-2",
      allocatedCount: 10,
      requestedCount: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["ticket"], "ticket-manager-1"));
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "batch-1", memberId: "member-2", allocatedCount: 10 }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "allocation-1",
      batchId: "batch-1",
      memberId: "member-2",
      allocatedCount: 10,
      requestedCount: null,
    });
    expect(prisma.ticketAllocation.upsert).toHaveBeenCalledWith({
      where: { batchId_memberId: { batchId: "batch-1", memberId: "member-2" } },
      create: { batchId: "batch-1", memberId: "member-2", allocatedCount: 10 },
      update: { allocatedCount: 10, requestedCount: null },
    });
  });

  it("正常（一般団員が自分の希望枚数申請）: requestedCountに入りallocatedCountは変更されない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(openBatch as any);
    vi.mocked(prisma.ticketAllocation.upsert).mockResolvedValue({
      id: "allocation-1",
      batchId: "batch-1",
      memberId: "member-1",
      allocatedCount: 0,
      requestedCount: 8,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "batch-1", allocatedCount: 8 }),
    });

    expect(res.status).toBe(201);
    expect(prisma.ticketAllocation.upsert).toHaveBeenCalledWith({
      where: { batchId_memberId: { batchId: "batch-1", memberId: actingMember.id } },
      create: { batchId: "batch-1", memberId: actingMember.id, requestedCount: 8 },
      update: { requestedCount: 8 },
    });
  });

  it("正常（ticket担当者が自分の分を登録）: 締切後でも通る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketBatch.findUnique).mockResolvedValue(closedBatch as any);
    vi.mocked(prisma.ticketAllocation.upsert).mockResolvedValue({
      id: "allocation-1",
      batchId: "batch-1",
      memberId: "ticket-manager-1",
      allocatedCount: 3,
      requestedCount: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["ticket"], "ticket-manager-1"));
    const res = await app.request(`/tickets/${testConcert.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: "batch-1", allocatedCount: 3 }),
    });

    expect(res.status).toBe(201);
  });
});

describe("PATCH /tickets/allocations/:id", () => {
  const openAllocation = {
    id: "allocation-1",
    batchId: "batch-1",
    memberId: "member-1",
    allocatedCount: 10,
    requestedCount: null,
    soldAdult: 0,
    soldStudent: 0,
    soldOther: 0,
    returnedCount: 0,
    outreachCount: 0,
    isCollected: false,
    reportedAt: null,
    batch: { concert: { ...testConcert, ticketInputClosedAt: null } },
  };
  const closedAllocation = {
    ...openAllocation,
    batch: { concert: { ...testConcert, ticketInputClosedAt: new Date("2020-01-01T00:00:00Z") } },
  };

  it("バリデーションエラー: soldAdultが負数は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldAdult: -1 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("配布記録が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/tickets/allocations/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldAdult: 1 }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("自分以外・非担当者: 403 FORBIDDENを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(openAllocation as any);

    const app = createTestApp(makeMember(["member"], "member-other"));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldAdult: 1 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("一般団員がallocatedCountを指定: 403 FORBIDDENを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(openAllocation as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocatedCount: 20 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("一般団員がisOutreachExpensePaidを指定: 403 FORBIDDENを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(openAllocation as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOutreachExpensePaid: true }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("締切後・非担当者が自分の記録を編集: 403 INPUT_CLOSEDを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(closedAllocation as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldAdult: 1 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("INPUT_CLOSED");
  });

  it("正常: 販売数変更でreportedAtが更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(openAllocation as any);
    vi.mocked(prisma.ticketAllocation.update).mockResolvedValue({
      ...openAllocation,
      soldAdult: 5,
      reportedAt: new Date("2026-06-01T00:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldAdult: 5 }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.reportedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(prisma.ticketAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ soldAdult: 5, reportedAt: expect.any(Date) }),
      }),
    );
  });

  it("正常: outreachCountのみ変更ではreportedAtは更新されない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.ticketAllocation.findUnique).mockResolvedValue(openAllocation as any);
    vi.mocked(prisma.ticketAllocation.update).mockResolvedValue({
      ...openAllocation,
      outreachCount: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/allocations/allocation-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outreachCount: 3 }),
    });

    expect(res.status).toBe(200);
    expect(prisma.ticketAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { outreachCount: 3 },
      }),
    );
  });
});
