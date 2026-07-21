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
    concert: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eventCategory: { findFirst: vi.fn(), create: vi.fn() },
    event: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
    member: { findMany: vi.fn(), findUnique: vi.fn() },
    concertSurvey: {
      updateMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    surveyResponse: { createMany: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("../../services/onstage.js", () => ({
  syncOnStageFromResponses: vi.fn(),
  applySurveyToOnStage: vi.fn(),
}));

import { prisma } from "../../lib/prisma.js";
import { syncOnStageFromResponses, applySurveyToOnStage } from "../../services/onstage.js";
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
  visitorFormToken: null,
  visitorIntroSubjectTemplate: "見学者のご紹介",
  visitorIntroBodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
  visitorIntroLineTemplate: "・{name}さん（希望パート: {part} / 出身団体: {origin}）",
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

describe("PATCH /concerts/:id", () => {
  it("バリデーションエラー: heldOnがdatetime形式（date形式でない）は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heldOn: "2026-11-23T00:00:00+09:00" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}`, {
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
    const res = await app.request("/concerts/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（linkedEventあり）: title/heldOn/venue変更がEventにも連動する", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      linkedEvent: { id: "event-1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.concert.update).mockResolvedValue({
      id: testConcert.id,
      title: "改訂版タイトル",
      heldOn: new Date("2026-12-01T00:00:00Z"),
      venue: "△△ホール",
      status: "draft",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "改訂版タイトル",
        heldOn: "2026-12-01",
        venue: "△△ホール",
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      id: testConcert.id,
      title: "改訂版タイトル",
      heldOn: "2026-12-01T00:00:00.000Z",
      venue: "△△ホール",
      status: "draft",
    });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: "event-1", orgId: testOrg.id },
      data: {
        title: "改訂版タイトル",
        startsAt: new Date("2026-12-01"),
        endsAt: new Date("2026-12-01"),
        location: "△△ホール",
      },
    });
  });

  it("正常（linkedEventなし）: event.updateは呼ばれない", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      linkedEvent: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue(testConcert as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("正常: statusのみ更新するとEventの更新フィールドは空になる", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      linkedEvent: { id: "event-1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.concert.update).mockResolvedValue({
      ...testConcert,
      status: "survey_open",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "survey_open" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.concert.update).toHaveBeenCalledWith({
      where: { id: testConcert.id },
      data: { status: "survey_open" },
    });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: "event-1", orgId: testOrg.id },
      data: {},
    });
  });

  it("正常: outreachExpensePerTripが更新される", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      linkedEvent: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.concert.update).mockResolvedValue({
      ...testConcert,
      outreachExpensePerTrip: 3000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outreachExpensePerTrip: 3000 }),
    });

    expect(res.status).toBe(200);
    expect(prisma.concert.update).toHaveBeenCalledWith({
      where: { id: testConcert.id },
      data: { outreachExpensePerTrip: 3000 },
    });
  });
});

describe("DELETE /concerts/:id", () => {
  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}`, { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/concerts/nonexistent", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（linkedEventあり）: 204を返しEvent・Concertともに削除される", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      linkedEvent: { id: "event-1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.delete).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: "event-1" } });
    expect(prisma.concert.delete).toHaveBeenCalledWith({ where: { id: testConcert.id } });
  });

  it("正常（linkedEventなし）: event.deleteは呼ばれない", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      linkedEvent: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/concerts/${testConcert.id}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });
});

describe("POST /concerts/:concertId/surveys", () => {
  it("バリデーションエラー: titleが空は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech+未満（member）: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第1回調査" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/concerts/nonexistent/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第1回調査" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 既存の開放中調査が自動クローズされconcert.statusがsurvey_openになる", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      stages: [{ id: "stage-1" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([{ id: "member-1" }] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.concertSurvey.create).mockResolvedValue({
      id: "survey-1",
      title: "第2回調査",
      isOpen: true,
      openAt: new Date("2026-08-01T00:00:00Z"),
      closeAt: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.surveyResponse.createMany).mockResolvedValue({ count: 1 } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第2回調査" }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "survey-1",
      title: "第2回調査",
      isOpen: true,
      openAt: "2026-08-01T00:00:00.000Z",
      closeAt: null,
      responseCount: 0,
    });
    expect(prisma.concertSurvey.updateMany).toHaveBeenCalledWith({
      where: { concertId: testConcert.id, isOpen: true },
      data: { isOpen: false },
    });
    expect(prisma.concert.update).toHaveBeenCalledWith({
      where: { id: testConcert.id },
      data: { status: "survey_open" },
    });
  });

  it("正常: ステージ×アクティブメンバー（guest/visitor除外）の直積でsurveyResponseが作成される", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      stages: [{ id: "stage-1" }, { id: "stage-2" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-1" },
      { id: "member-2" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.concertSurvey.create).mockResolvedValue({
      id: "survey-1",
      title: "第1回調査",
      isOpen: true,
      openAt: new Date("2026-08-01T00:00:00Z"),
      closeAt: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.surveyResponse.createMany).mockResolvedValue({ count: 4 } as any);

    const app = createTestApp(makeMember(["tech"]));
    await app.request(`/concerts/${testConcert.id}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第1回調査" }),
    });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: testOrg.id, status: "active" }),
      }),
    );
    expect(prisma.surveyResponse.createMany).toHaveBeenCalledWith({
      data: [
        { surveyId: "survey-1", memberId: "member-1", stageId: "stage-1", status: "undecided" },
        { surveyId: "survey-1", memberId: "member-1", stageId: "stage-2", status: "undecided" },
        { surveyId: "survey-1", memberId: "member-2", stageId: "stage-1", status: "undecided" },
        { surveyId: "survey-1", memberId: "member-2", stageId: "stage-2", status: "undecided" },
      ],
    });
  });

  it("正常: ステージ0件の場合はsurveyResponse.createManyが呼ばれない", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue({
      ...testConcert,
      stages: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([{ id: "member-1" }] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.concertSurvey.create).mockResolvedValue({
      id: "survey-1",
      title: "第1回調査",
      isOpen: true,
      openAt: new Date("2026-08-01T00:00:00Z"),
      closeAt: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "第1回調査" }),
    });

    expect(res.status).toBe(201);
    expect(prisma.surveyResponse.createMany).not.toHaveBeenCalled();
  });
});

describe("GET /concerts/:concertId/surveys/:surveyId", () => {
  const testSurvey = {
    id: "survey-1",
    concertId: "concert-1",
    title: "第1回調査",
    isOpen: true,
    closeAt: null,
    concert: { orgId: "org-1", stages: [{ id: "stage-1" }, { id: "stage-2" }] },
    surveyResponses: [
      { stageId: "stage-1", status: "attending", memberId: "member-1", memo: null },
      { stageId: "stage-2", status: "maybe", memberId: "member-1", memo: "体調次第" },
      { stageId: "stage-1", status: "absent", memberId: "member-2", memo: null },
    ],
  };
  const orgMembers = [
    {
      id: "member-1",
      userRef: { nameJa: "山田 太郎" },
      part: { id: "part-1", name: "Tenor I", sortOrder: 1, voiceType: "tenor" },
    },
    {
      id: "member-2",
      userRef: { nameJa: "鈴木 次郎" },
      part: null,
    },
  ];

  it("visitor: 403を返す", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`);

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("調査が存在しない/別演奏会/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/nonexistent`);

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: stageSummariesがattending/absent/undecidedを集計する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue(orgMembers as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.stageSummaries).toEqual([
      { stageId: "stage-1", summary: { attending: 1, absent: 1, undecided: 0 } },
      { stageId: "stage-2", summary: { attending: 0, absent: 0, undecided: 2 } },
    ]);
  });

  it("正常: memoはステージ横断で最初に見つかった値が返る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue(orgMembers as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`);

    const body = await json(res);
    const row1 = body.data.rows.find((r: { memberId: string }) => r.memberId === "member-1");
    expect(row1.memo).toBe("体調次第");
  });

  it("正常: statusがmaybeの場合はundecidedに丸められる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue(orgMembers as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`);

    const body = await json(res);
    const row1 = body.data.rows.find((r: { memberId: string }) => r.memberId === "member-1");
    const stage2 = row1.stages.find((s: { stageId: string }) => s.stageId === "stage-2");
    expect(stage2.status).toBe("undecided");
  });

  it("正常: 回答が無いメンバー・ステージはundecided扱い", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue(orgMembers as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`);

    const body = await json(res);
    const row2 = body.data.rows.find((r: { memberId: string }) => r.memberId === "member-2");
    const stage2 = row2.stages.find((s: { stageId: string }) => s.stageId === "stage-2");
    expect(stage2.status).toBe("undecided");
  });
});

describe("PATCH /concerts/:concertId/surveys/:surveyId", () => {
  const testSurvey = {
    id: "survey-1",
    concertId: "concert-1",
    title: "第1回調査",
    isOpen: true,
    closeAt: null,
  };

  it("バリデーションエラー: titleが空文字は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech+未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: false }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/concerts/nonexistent/surveys/survey-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: false }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("調査が別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue({
      ...testSurvey,
      concertId: "other-concert",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: false }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("isOpen:true: 他の開放中調査が自動クローズされstatusがsurvey_openになる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    vi.mocked(prisma.concertSurvey.update).mockResolvedValue({
      id: "survey-1",
      title: "第1回調査",
      isOpen: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.updateMany).mockResolvedValue({ count: 1 } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: true }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.concertStatus).toBe("survey_open");
    expect(prisma.concertSurvey.updateMany).toHaveBeenCalledWith({
      where: { concertId: testConcert.id, isOpen: true, id: { not: "survey-1" } },
      data: { isOpen: false },
    });
    expect(prisma.concert.update).toHaveBeenCalledWith({
      where: { id: testConcert.id },
      data: { status: "survey_open" },
    });
    expect(applySurveyToOnStage).not.toHaveBeenCalled();
  });

  it("isOpen:false・他に開放中調査なし: statusがconfirmedになりapplySurveyToOnStageが呼ばれる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    vi.mocked(prisma.concertSurvey.update).mockResolvedValue({
      id: "survey-1",
      title: "第1回調査",
      isOpen: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.concertSurvey.count).mockResolvedValue(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any);
    vi.mocked(applySurveyToOnStage).mockResolvedValue(undefined);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: false }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.concertStatus).toBe("confirmed");
    expect(prisma.concert.update).toHaveBeenCalledWith({
      where: { id: testConcert.id },
      data: { status: "confirmed" },
    });
    expect(applySurveyToOnStage).toHaveBeenCalledWith(testConcert.id, "survey-1");
  });

  it("isOpen:false・他に開放中調査あり: statusはsurvey_openのままapplySurveyToOnStageは呼ばれない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    vi.mocked(prisma.concertSurvey.update).mockResolvedValue({
      id: "survey-1",
      title: "第1回調査",
      isOpen: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.concertSurvey.count).mockResolvedValue(1);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: false }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.concertStatus).toBe("survey_open");
    expect(prisma.concert.update).not.toHaveBeenCalled();
    expect(applySurveyToOnStage).not.toHaveBeenCalled();
  });

  it("isOpen未指定（titleのみ）: concertStatusは現状維持", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(testSurvey as any);
    vi.mocked(prisma.concertSurvey.update).mockResolvedValue({
      id: "survey-1",
      title: "改題",
      isOpen: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.concertStatus).toBe(testConcert.status);
    expect(prisma.concert.update).not.toHaveBeenCalled();
    expect(prisma.concertSurvey.updateMany).not.toHaveBeenCalled();
  });
});

describe("PUT /concerts/:concertId/surveys/:surveyId/respond", () => {
  const openSurvey = { id: "survey-1", concertId: "concert-1", isOpen: true };
  const closedSurvey = { id: "survey-1", concertId: "concert-1", isOpen: false };
  const validBody = { responses: [{ stageId: "stage-1", status: "attending" }] };

  it("バリデーションエラー: responsesが空配列は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: [] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/concerts/nonexistent/surveys/survey-1/respond", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("調査が別演奏会に属する: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue({
      ...openSurvey,
      concertId: "other-concert",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("締切済み・非admin: 403 LOCKEDを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(closedSurvey as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("LOCKED");
  });

  it("締切済み・admin: 通りsyncOnStageFromResponsesが呼ばれる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(closedSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findMany).mockResolvedValue([{ id: "stage-1" }] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.surveyResponse.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(syncOnStageFromResponses).mockResolvedValue(undefined);

    const actingAdmin = makeMember(["admin"], "admin-1");
    const app = createTestApp(actingAdmin);
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(200);
    expect(syncOnStageFromResponses).toHaveBeenCalledWith(testConcert.id, [
      { memberId: actingAdmin.id, stageId: "stage-1", status: "attending" },
    ]);
  });

  it("targetMemberId指定・自分以外・非admin: 403 FORBIDDENを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(openSurvey as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, targetMemberId: "member-2" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("targetMemberId指定・admin・対象が別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(openSurvey as any);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, targetMemberId: "other-org-member" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("無効なステージIDが混入: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(openSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findMany).mockResolvedValue([{ id: "stage-1" }] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: [{ stageId: "other-stage", status: "attending" }] }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.surveyResponse.updateMany).not.toHaveBeenCalled();
  });

  it("正常: 自分の回答を更新する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(openSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findMany).mockResolvedValue([{ id: "stage-1" }] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.surveyResponse.updateMany).mockResolvedValue({ count: 1 } as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, memo: "少し遅れます" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ ok: true });
    expect(prisma.surveyResponse.updateMany).toHaveBeenCalledWith({
      where: { surveyId: "survey-1", memberId: actingMember.id, stageId: "stage-1" },
      data: { status: "attending", memo: "少し遅れます" },
    });
    expect(syncOnStageFromResponses).not.toHaveBeenCalled();
  });

  it("正常: memo未指定時はmemoが更新されない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concertSurvey.findUnique).mockResolvedValue(openSurvey as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findMany).mockResolvedValue([{ id: "stage-1" }] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.surveyResponse.updateMany).mockResolvedValue({ count: 1 } as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    await app.request(`/concerts/${testConcert.id}/surveys/survey-1/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(prisma.surveyResponse.updateMany).toHaveBeenCalledWith({
      where: { surveyId: "survey-1", memberId: actingMember.id, stageId: "stage-1" },
      data: { status: "attending" },
    });
  });
});
