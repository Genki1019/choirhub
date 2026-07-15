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
    concert: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    eventCategory: { findFirst: vi.fn(), create: vi.fn() },
    event: { create: vi.fn() },
    stage: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    program: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    score: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
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

const testConcert = {
  id: "concert-1",
  orgId: "org-1",
  title: "第20回定期演奏会",
  heldOn: new Date("2026-11-23T00:00:00Z"),
  venue: "○○ホール",
  status: "draft",
};

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

describe("POST /concerts/:concertId/stages", () => {
  it("バリデーションエラー: nameが空は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "第2ステージ" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "第2ステージ" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 201を返しsortOrderが既存最大+1になる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.aggregate).mockResolvedValue({
      _max: { sortOrder: 2 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.stage.create).mockResolvedValue({
      id: "stage-3",
      name: "第3ステージ",
      sortOrder: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "第3ステージ" }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({ id: "stage-3", name: "第3ステージ", sortOrder: 3, programs: [] });
    expect(prisma.stage.create).toHaveBeenCalledWith({
      data: { concertId: testConcert.id, name: "第3ステージ", sortOrder: 3 },
    });
  });
});

describe("PATCH /concerts/:concertId/stages/:stageId", () => {
  it("バリデーションエラー: nameが空は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/stages/stage-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("ステージが別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.findUnique).mockResolvedValue({
      id: "stage-1",
      concertId: "other-concert",
      name: "第1ステージ",
      sortOrder: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 200を返しname更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.findUnique).mockResolvedValue({
      id: "stage-1",
      concertId: testConcert.id,
      name: "第1ステージ",
      sortOrder: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.stage.update).mockResolvedValue({
      id: "stage-1",
      name: "第1ステージ（改）",
      sortOrder: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "第1ステージ（改）" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: "stage-1", name: "第1ステージ（改）", sortOrder: 1 });
  });
});

describe("PUT /concerts/:concertId/stages/order", () => {
  it("バリデーションエラー: idsが空配列は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["stage-1"] }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/stages/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["stage-1"] }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他コンサートのstageIdが混入: 400 BAD_REQUESTを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findMany).mockResolvedValue([{ id: "stage-1" }] as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["stage-1", "other-concert-stage"] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it("正常: 204を返し部分的なid配列でもそのidだけ並び替えられる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.findMany).mockResolvedValue([
      { id: "stage-1" },
      { id: "stage-2" },
      { id: "stage-3" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["stage-2", "stage-1"] }),
    });

    expect(res.status).toBe(204);
    expect(prisma.stage.update).toHaveBeenCalledTimes(2);
    expect(prisma.stage.update).toHaveBeenCalledWith({
      where: { id: "stage-2" },
      data: { sortOrder: 1 },
    });
    expect(prisma.stage.update).toHaveBeenCalledWith({
      where: { id: "stage-1" },
      data: { sortOrder: 2 },
    });
  });
});

describe("POST /concerts/:concertId/stages/:stageId/programs", () => {
  const testStage = { id: "stage-1", concertId: testConcert.id, name: "第1ステージ", sortOrder: 1 };

  it("バリデーションエラー: scoreIdもtitleも無しは400を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("バリデーションエラー: titleが空白のみは400を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新曲" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/stages/stage-1/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新曲" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("ステージが別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.findUnique).mockResolvedValue({
      id: "stage-1",
      concertId: "other-concert",
      name: "第1ステージ",
      sortOrder: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新曲" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("scoreId指定・楽譜が存在しない/別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreId: "score-1" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（scoreId指定）: 201を返しaccessLevelを送っても既存楽譜は更新されない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      id: "score-1",
      orgId: "org-1",
      title: "既存楽譜",
      composer: "既存作曲家",
      arranger: null,
      accessLevel: "secret",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.program.aggregate).mockResolvedValue({
      _max: { sortOrder: 2 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.program.create).mockResolvedValue({
      id: "program-1",
      title: "既存楽譜",
      sortOrder: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreId: "score-1", accessLevel: "restricted" }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "program-1",
      title: "既存楽譜",
      sortOrder: 3,
      score: { id: "score-1", composer: "既存作曲家", arranger: null },
    });
    expect(prisma.score.update).not.toHaveBeenCalled();
    expect(prisma.program.create).toHaveBeenCalledWith({
      data: { stageId: "stage-1", scoreId: "score-1", title: "既存楽譜", sortOrder: 3 },
    });
  });

  it("正常（title指定・新規楽譜作成）: 201を返しscore.createにaccessLevelが渡る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);
    vi.mocked(prisma.program.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.score.create).mockResolvedValue({
      id: "score-new",
      composer: "新作曲家",
      arranger: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.program.create).mockResolvedValue({
      id: "program-1",
      title: "新曲",
      sortOrder: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "新曲",
        composer: "新作曲家",
        accessLevel: "public",
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.score).toEqual({ id: "score-new", composer: "新作曲家", arranger: null });
    expect(prisma.score.create).toHaveBeenCalledWith({
      data: {
        orgId: testOrg.id,
        title: "新曲",
        composer: "新作曲家",
        arranger: null,
        accessLevel: "public",
      },
    });
    expect(prisma.program.create).toHaveBeenCalledWith({
      data: { stageId: "stage-1", scoreId: "score-new", title: "新曲", sortOrder: 1 },
    });
  });
});

describe("PUT /concerts/:concertId/stages/:stageId/programs/order", () => {
  const testStage = { id: "stage-1", concertId: testConcert.id, name: "第1ステージ", sortOrder: 1 };

  it("バリデーションエラー: idsが空配列は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["program-1"] }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/stages/stage-1/programs/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["program-1"] }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("ステージが別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.findUnique).mockResolvedValue({
      id: "stage-1",
      concertId: "other-concert",
      name: "第1ステージ",
      sortOrder: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["program-1"] }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他ステージのprogramIdが混入: 400 BAD_REQUESTを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.program.findMany).mockResolvedValue([{ id: "program-1" }] as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["program-1", "other-stage-program"] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(prisma.program.update).not.toHaveBeenCalled();
  });

  it("正常: 204を返し並び替えられる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);
    vi.mocked(prisma.program.findMany).mockResolvedValue([
      { id: "program-1" },
      { id: "program-2" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.program.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/stages/stage-1/programs/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["program-2", "program-1"] }),
    });

    expect(res.status).toBe(204);
    expect(prisma.program.update).toHaveBeenCalledTimes(2);
    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: "program-2" },
      data: { sortOrder: 1 },
    });
  });
});

describe("DELETE /concerts/:concertId/programs/:programId", () => {
  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/programs/program-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("演目が別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.program.findUnique).mockResolvedValue({
      id: "program-1",
      stageId: "stage-1",
      title: "曲A",
      sortOrder: 1,
      stage: { concertId: "other-concert" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 204を返し演目のみ削除され楽譜本体は削除されない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.program.findUnique).mockResolvedValue({
      id: "program-1",
      stageId: "stage-1",
      title: "曲A",
      sortOrder: 1,
      stage: { concertId: testConcert.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.program.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(prisma.program.delete).toHaveBeenCalledWith({
      where: { id: "program-1", stageId: "stage-1" },
    });
  });
});

describe("PATCH /concerts/:concertId/programs/:programId", () => {
  it("バリデーションエラー: titleが空文字は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent/programs/program-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("演目が別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.program.findUnique).mockResolvedValue({
      id: "program-1",
      stageId: "stage-1",
      scoreId: "score-1",
      title: "曲A",
      sortOrder: 1,
      stage: { concertId: "other-concert" },
      score: { id: "score-1", composer: null, arranger: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: titleのみ更新しscoreは更新されない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.program.findUnique).mockResolvedValue({
      id: "program-1",
      stageId: "stage-1",
      scoreId: "score-1",
      title: "曲A",
      sortOrder: 1,
      stage: { concertId: testConcert.id },
      score: { id: "score-1", composer: "作曲家A", arranger: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.program.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "曲A（改）" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "program-1",
      title: "曲A（改）",
      sortOrder: 1,
      score: { id: "score-1", composer: "作曲家A", arranger: null },
    });
    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: "program-1" },
      data: { title: "曲A（改）" },
    });
    expect(prisma.score.update).not.toHaveBeenCalled();
  });

  it("正常: composer/arrangerを更新するとscoreIdがある場合のみscore.updateが呼ばれる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.program.findUnique).mockResolvedValue({
      id: "program-1",
      stageId: "stage-1",
      scoreId: "score-1",
      title: "曲A",
      sortOrder: 1,
      stage: { concertId: testConcert.id },
      score: { id: "score-1", composer: "旧作曲家", arranger: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.score.update).mockResolvedValue({
      id: "score-1",
      composer: "新作曲家",
      arranger: "新編曲家",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}/programs/program-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ composer: "新作曲家", arranger: "新編曲家" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.score).toEqual({ id: "score-1", composer: "新作曲家", arranger: "新編曲家" });
    expect(prisma.score.update).toHaveBeenCalledWith({
      where: { id: "score-1" },
      data: { composer: "新作曲家", arranger: "新編曲家" },
      select: { id: true, composer: true, arranger: true },
    });
    expect(prisma.program.update).not.toHaveBeenCalled();
  });
});

describe("GET /concerts/:id", () => {
  const makeAssignment = (memberId: string, roles: string[]) => ({
    memberId,
    stageId: "stage-1",
    status: "on",
    member: {
      roles,
      userRef: { nameJa: `メンバー${memberId}` },
      part: { id: "part-1", name: "Tenor I", sortOrder: 1, voiceType: "tenor" },
    },
  });

  const makeSlot = (memberId: string | null, roles?: string[]) => ({
    id: `slot-${memberId ?? "empty"}`,
    memberId,
    label: memberId ? null : "指揮者名",
    boxId: memberId ? null : "box-1",
    rowNum: memberId ? 1 : null,
    positionOrder: 1,
    member: memberId
      ? {
          roles: roles ?? ["member"],
          userRef: { nameJa: `メンバー${memberId}` },
          part: { name: "Tenor I" },
        }
      : null,
  });

  const fullConcert = {
    id: "concert-1",
    orgId: "org-1",
    title: "第20回定期演奏会",
    heldOn: new Date("2026-11-23T00:00:00Z"),
    venue: "○○ホール",
    status: "confirmed",
    appliedSurveyId: "survey-1",
    linkedEvent: { id: "event-1" },
    stages: [
      {
        id: "stage-1",
        name: "第1ステージ",
        sortOrder: 1,
        programs: [
          {
            id: "program-1",
            title: "曲A",
            sortOrder: 1,
            score: { id: "score-1", composer: "作曲家A", arranger: null },
          },
        ],
        formationPatterns: [
          {
            id: "pattern-1",
            name: "パターン1",
            sortOrder: 1,
            isStaggered: false,
            pianoPosition: "center",
            boxes: [{ id: "box-1", kind: "conductor", title: null, sortOrder: 1 }],
            slots: [makeSlot("member-1"), makeSlot("member-hidden", ["guest"]), makeSlot(null)],
          },
        ],
      },
    ],
    concertSurveys: [
      {
        id: "survey-1",
        title: "第20回定演 出演調査",
        isOpen: false,
        openAt: new Date("2026-08-01T00:00:00Z"),
        closeAt: new Date("2026-08-31T23:59:59Z"),
        _count: { surveyResponses: 42 },
      },
    ],
    onStageAssignments: [
      makeAssignment("member-1", ["member"]),
      makeAssignment("member-hidden", ["visitor"]),
    ],
  };

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("visitor: 限定データ（formationPatterns省略・surveys/assignmentsは空）を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(fullConcert as any);

    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request(`/concerts/${fullConcert.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.stages[0].programs).toHaveLength(1);
    expect(body.data.stages[0].formationPatterns).toBeUndefined();
    expect(body.data.surveys).toEqual([]);
    expect(body.data.assignments).toEqual([]);
  });

  it("member: フル情報（formationPatterns・surveys・assignments含む）を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(fullConcert as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${fullConcert.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.linkedEventId).toBe("event-1");
    expect(body.data.appliedSurveyId).toBe("survey-1");
    expect(body.data.surveys).toEqual([
      {
        id: "survey-1",
        title: "第20回定演 出演調査",
        isOpen: false,
        openAt: "2026-08-01T00:00:00.000Z",
        closeAt: "2026-08-31T23:59:59.000Z",
        responseCount: 42,
      },
    ]);
    expect(body.data.stages[0].formationPatterns[0].boxes).toEqual([
      { id: "box-1", kind: "conductor", title: null, sortOrder: 1 },
    ]);
  });

  it("guest/visitorロールのメンバーはassignments・slotsから除外される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(fullConcert as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${fullConcert.id}`);

    const body = await json(res);
    expect(body.data.assignments).toHaveLength(1);
    expect(body.data.assignments[0].memberId).toBe("member-1");

    const slots = body.data.stages[0].formationPatterns[0].slots;
    expect(slots.map((s: { memberId: string | null }) => s.memberId)).toEqual(["member-1", null]);
  });

  it("linkedEventが無い演奏会: linkedEventIdはnull", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...fullConcert,
      linkedEvent: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${fullConcert.id}`);

    const body = await json(res);
    expect(body.data.linkedEventId).toBeNull();
  });

  it("ステージ・調査・オンステ確定が0件: 空配列で返る", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...fullConcert,
      stages: [],
      concertSurveys: [],
      onStageAssignments: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${fullConcert.id}`);

    const body = await json(res);
    expect(body.data.stages).toEqual([]);
    expect(body.data.surveys).toEqual([]);
    expect(body.data.assignments).toEqual([]);
  });
});
