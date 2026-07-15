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
    concert: { findUnique: vi.fn() },
    concertSurvey: { findUnique: vi.fn() },
    stage: { findUnique: vi.fn() },
    formationPattern: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    member: { findMany: vi.fn() },
    onStageAssignment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../services/onstage.js", () => ({
  applySurveyToOnStage: vi.fn(),
}));

import { prisma } from "../../lib/prisma.js";
import { formationRouter } from "../formation.js";

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

const testStage = { id: "stage-1", concertId: "concert-1", name: "第1ステージ", sortOrder: 1 };

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", formationRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /concerts/:concertId/stages/:stageId/formation-patterns", () => {
  it("バリデーションエラー: nameが空は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      },
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "パターン1" }),
      },
    );

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/nonexistent/stages/${testStage.id}/formation-patterns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "パターン1" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("ステージが別演奏会に属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.stage.findUnique).mockResolvedValue({
      ...testStage,
      concertId: "other-concert",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "パターン1" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 201を返しconductor/pianoの固定枠が自動作成される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.stage.findUnique).mockResolvedValue(testStage as any);
    vi.mocked(prisma.formationPattern.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.formationPattern.create).mockResolvedValue({
      id: "pattern-1",
      name: "パターン1",
      sortOrder: 1,
      isStaggered: false,
      pianoPosition: "center",
      boxes: [
        { id: "box-1", kind: "conductor", title: null, sortOrder: 1 },
        { id: "box-2", kind: "piano", title: null, sortOrder: 2 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "パターン1" }),
      },
    );

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "pattern-1",
      name: "パターン1",
      sortOrder: 1,
      isStaggered: false,
      pianoPosition: "center",
      boxes: [
        { id: "box-1", kind: "conductor", title: null, sortOrder: 1 },
        { id: "box-2", kind: "piano", title: null, sortOrder: 2 },
      ],
      slots: [],
    });
    expect(prisma.formationPattern.create).toHaveBeenCalledWith({
      data: {
        stageId: testStage.id,
        name: "パターン1",
        sortOrder: 1,
        boxes: {
          create: [
            { kind: "conductor", sortOrder: 1 },
            { kind: "piano", sortOrder: 2 },
          ],
        },
      },
      include: { boxes: true },
    });
  });
});

describe("PATCH /concerts/:concertId/stages/:stageId/formation-patterns/:patternId", () => {
  const testPattern = {
    id: "pattern-1",
    stageId: "stage-1",
    name: "パターン1",
    sortOrder: 1,
    isStaggered: false,
    pianoPosition: "center",
  };

  it("バリデーションエラー: pianoPositionが不正な値は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pianoPosition: "invalid" }),
      },
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "改名" }),
      },
    );

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/nonexistent/stages/${testStage.id}/formation-patterns/pattern-1`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "改名" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("パターンが別ステージに属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.formationPattern.findUnique).mockResolvedValue({
      ...testPattern,
      stageId: "other-stage",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "改名" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 部分更新されboxes/slotsを含まないレスポンスを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.formationPattern.findUnique).mockResolvedValue(testPattern as any);
    vi.mocked(prisma.formationPattern.update).mockResolvedValue({
      ...testPattern,
      name: "パターン1（改）",
      isStaggered: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "パターン1（改）", isStaggered: true }),
      },
    );

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "pattern-1",
      name: "パターン1（改）",
      sortOrder: 1,
      isStaggered: true,
      pianoPosition: "center",
    });
    expect(body.data.boxes).toBeUndefined();
    expect(body.data.slots).toBeUndefined();
  });
});

describe("DELETE /concerts/:concertId/stages/:stageId/formation-patterns/:patternId", () => {
  const testPattern = { id: "pattern-1", stageId: "stage-1", name: "パターン1", sortOrder: 1 };

  it("tech未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/nonexistent/stages/${testStage.id}/formation-patterns/pattern-1`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("パターンが別ステージに属する（IDOR）: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.formationPattern.findUnique).mockResolvedValue({
      ...testPattern,
      stageId: "other-stage",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.formationPattern.findUnique).mockResolvedValue(testPattern as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.formationPattern.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/pattern-1`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(204);
    expect(prisma.formationPattern.delete).toHaveBeenCalledWith({ where: { id: "pattern-1" } });
  });
});

describe("PUT /concerts/:concertId/stages/:stageId/formation-patterns/order", () => {
  it("バリデーションエラー: idsが空配列は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      },
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["pattern-1"] }),
      },
    );

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/nonexistent/stages/${testStage.id}/formation-patterns/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["pattern-1"] }),
      },
    );

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他ステージのpatternIdが混入: 400 BAD_REQUESTを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.formationPattern.findMany).mockResolvedValue([{ id: "pattern-1" }] as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["pattern-1", "other-stage-pattern"] }),
      },
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(prisma.formationPattern.update).not.toHaveBeenCalled();
  });

  it("正常: 204を返し並び替えられる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.formationPattern.findMany).mockResolvedValue([
      { id: "pattern-1" },
      { id: "pattern-2" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.formationPattern.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(
      `/concerts/${testConcert.id}/stages/${testStage.id}/formation-patterns/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["pattern-2", "pattern-1"] }),
      },
    );

    expect(res.status).toBe(204);
    expect(prisma.formationPattern.update).toHaveBeenCalledTimes(2);
    expect(prisma.formationPattern.update).toHaveBeenCalledWith({
      where: { id: "pattern-2" },
      data: { sortOrder: 1 },
    });
  });
});
