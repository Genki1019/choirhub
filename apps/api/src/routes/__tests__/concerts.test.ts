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
    concert: { create: vi.fn(), findMany: vi.fn() },
    eventCategory: { findFirst: vi.fn(), create: vi.fn() },
    event: { create: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { concertsRouter } from "../concerts.js";

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
  app.route("/", concertsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /concerts", () => {
  it("バリデーションエラー: titleが空は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", heldOn: "2026-11-23T00:00:00+09:00" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("バリデーションエラー: heldOnがオフセット無しの日付のみは400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第20回定期演奏会", heldOn: "2026-11-23" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/concerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第20回定期演奏会", heldOn: "2026-11-23T00:00:00+09:00" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常（concertカテゴリ未存在）: 201を返しカテゴリ・Eventが連携作成される", async () => {
    vi.mocked(prisma.concert.create).mockResolvedValue({
      id: "concert-1",
      title: "第20回定期演奏会",
      heldOn: new Date("2026-11-23T00:00:00.000Z"),
      venue: "○○ホール",
      status: "draft",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.eventCategory.create).mockResolvedValue({ id: "category-1" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-1" } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "第20回定期演奏会",
        heldOn: "2026-11-23T00:00:00Z",
        venue: "○○ホール",
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "concert-1",
      title: "第20回定期演奏会",
      heldOn: "2026-11-23T00:00:00.000Z",
      venue: "○○ホール",
      status: "draft",
      stageCount: 0,
      programCount: 0,
      hasSurvey: false,
      surveyOpen: false,
      linkedEventId: "event-1",
    });
    expect(prisma.eventCategory.create).toHaveBeenCalledWith({
      data: { orgId: testOrg.id, name: "本番", slug: "concert", color: "#EF4444", sortOrder: 2 },
    });
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: testOrg.id,
        categoryId: "category-1",
        concertId: "concert-1",
      }),
    });
  });

  it("正常（concertカテゴリ既存）: eventCategory.createは呼ばれない", async () => {
    vi.mocked(prisma.concert.create).mockResolvedValue({
      id: "concert-1",
      title: "第20回定期演奏会",
      heldOn: new Date("2026-11-23T00:00:00+09:00"),
      venue: null,
      status: "draft",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue({ id: "existing-category" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-1" } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第20回定期演奏会", heldOn: "2026-11-23T00:00:00+09:00" }),
    });

    expect(res.status).toBe(201);
    expect(prisma.eventCategory.create).not.toHaveBeenCalled();
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: "existing-category" }),
      }),
    );
  });
});

describe("GET /concerts", () => {
  it("正常: stageCount・programCount・hasSurvey・surveyOpenが集計される", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: new Date("2026-11-23T00:00:00Z"),
        venue: "○○ホール",
        status: "survey_open",
        stages: [
          { programs: [{ id: "program-1" }, { id: "program-2" }] },
          { programs: [{ id: "program-3" }] },
        ],
        concertSurveys: [
          { id: "survey-1", isOpen: false },
          { id: "survey-2", isOpen: true },
        ],
        linkedEvent: { id: "event-1" },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: "2026-11-23T00:00:00.000Z",
        venue: "○○ホール",
        status: "survey_open",
        stageCount: 2,
        programCount: 3,
        hasSurvey: true,
        surveyOpen: true,
        linkedEventId: "event-1",
      },
    ]);
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id } }),
    );
  });

  it("linkedEventが無い場合: linkedEventIdはnull", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "曲目未定演奏会",
        heldOn: new Date("2026-11-23T00:00:00Z"),
        venue: null,
        status: "draft",
        stages: [],
        concertSurveys: [],
        linkedEvent: null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0].linkedEventId).toBeNull();
    expect(body.data[0].hasSurvey).toBe(false);
    expect(body.data[0].surveyOpen).toBe(false);
  });

  it("演奏会が0件: 空配列を返す", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("GET /concerts/structure", () => {
  it("正常: id・title・stagesの軽量構造を返す", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        stages: [
          { id: "stage-1", name: "第1ステージ", sortOrder: 1 },
          { id: "stage-2", name: "第2ステージ", sortOrder: 2 },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts/structure");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        stages: [
          { id: "stage-1", name: "第1ステージ", sortOrder: 1 },
          { id: "stage-2", name: "第2ステージ", sortOrder: 2 },
        ],
      },
    ]);
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id } }),
    );
  });

  it("演奏会が0件: 空配列を返す", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts/structure");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});
