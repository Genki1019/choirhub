import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Member, Organization, Score } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    score: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    concert: { findMany: vi.fn() },
    part: { findMany: vi.fn(), findUnique: vi.fn() },
    member: { findMany: vi.fn() },
    scorePurchase: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    collection: { findFirst: vi.fn() },
    scoreFile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock("../../services/storage.js", () => ({
  storage: {
    getPresignedPutUrl: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    getScoreDownload: vi.fn(),
  },
  CONTENT_TYPES: { ".pdf": "application/pdf", ".mid": "audio/midi", ".mp3": "audio/mpeg" },
}));

import { prisma } from "../../lib/prisma.js";
import { storage } from "../../services/storage.js";
import { scoresRouter } from "../scores.js";

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

const testScore: Score = {
  id: "score-1",
  orgId: "org-1",
  title: "男声合唱のための〇〇",
  composer: "△△ △△",
  arranger: null,
  isCommissioned: false,
  accessLevel: "restricted",
  purchaseDate: null,
  distributionStart: null,
  purchasePrice: 1200,
  distributionPrice: 500,
  notes: null,
  createdAt: new Date("2024-01-01"),
};

const makeScoreFile = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "file-1",
  scoreId: "score-1",
  fileType: "full_score",
  partId: null,
  storageKey: "org-1/score-1/full_score/file-1.pdf",
  fileName: "楽譜.pdf",
  accessLevel: null,
  version: 1,
  uploadedBy: "member-1",
  uploadedAt: new Date("2024-01-01"),
  ...overrides,
});

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", scoresRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /scores", () => {
  it("正常: 軽量フィールドのみの一覧を返す", async () => {
    vi.mocked(prisma.score.findMany).mockResolvedValue([
      { id: "score-1", title: "曲A", composer: "作曲家A", arranger: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/scores");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      { id: "score-1", title: "曲A", composer: "作曲家A", arranger: null },
    ]);
    expect(prisma.score.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id } }),
    );
  });

  it("楽譜が0件: 空配列を返す", async () => {
    vi.mocked(prisma.score.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/scores");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("GET /scores/grouped", () => {
  it("正常: 演奏会に紐づく楽譜と未定の楽譜が正しく分類される", async () => {
    const assignedScore = { id: "score-1", title: "曲A", composer: "作曲家A", arranger: null };
    const unassignedScore = { id: "score-2", title: "曲B", composer: null, arranger: null };

    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: new Date("2026-11-23"),
        venue: "○○ホール",
        stages: [
          {
            id: "stage-1",
            name: "第1ステージ",
            sortOrder: 1,
            programs: [{ id: "program-1", title: "曲A", sortOrder: 1, score: assignedScore }],
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.score.findMany).mockResolvedValue([
      { ...assignedScore, programs: [{ id: "program-1" }] },
      { ...unassignedScore, programs: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/scores/grouped");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.concerts).toEqual([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: "2026-11-23",
        venue: "○○ホール",
        stages: [
          {
            id: "stage-1",
            name: "第1ステージ",
            sortOrder: 1,
            programs: [{ id: "program-1", title: "曲A", sortOrder: 1, score: assignedScore }],
          },
        ],
      },
    ]);
    expect(body.data.unassigned).toEqual([unassignedScore]);
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id } }),
    );
    expect(prisma.score.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id } }),
    );
  });

  it("プログラムにscoreが無い場合は除外される", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: new Date("2026-11-23"),
        venue: null,
        stages: [
          {
            id: "stage-1",
            name: "第1ステージ",
            sortOrder: 1,
            programs: [{ id: "program-1", title: "枠のみ", sortOrder: 1, score: null }],
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.score.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/scores/grouped");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.concerts[0].stages[0].programs).toEqual([]);
  });

  it("演奏会・楽譜とも0件: 空のconcerts・unassignedを返す", async () => {
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.score.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/scores/grouped");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ concerts: [], unassigned: [] });
  });
});

describe("GET /scores/:scoreId", () => {
  it("存在しない: 404 NOT_FOUNDを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/scores/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("別テナントの楽譜: 404 NOT_FOUNDを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      orgId: "other-org-id",
      files: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("visitor: 閲覧可（canDownload:false、secretでもfull_scoreのみ）", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      accessLevel: "secret",
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "full_score",
          fileName: "full.pdf",
          partId: null,
          version: 1,
        },
        {
          id: "file-2",
          scoreId: testScore.id,
          fileType: "midi",
          fileName: "part.mid",
          partId: null,
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.canAccessFiles).toBe(true);
    expect(body.data.canDownload).toBe(false);
    expect(body.data.purchasePrice).toBeUndefined();
    expect(body.data.purchaseCount).toBeUndefined();
    expect(body.data.hasCollection).toBe(false);
    expect(body.data.files).toHaveLength(1);
    expect(body.data.files[0].fileType).toBe("full_score");
  });

  it("admin/score: 全データ閲覧可（purchasePrice・purchaseCount・hasCollection含む）", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "full_score",
          fileName: "full.pdf",
          partId: null,
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);
    vi.mocked(prisma.scorePurchase.count).mockResolvedValue(5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.findFirst).mockResolvedValue({ id: "collection-1" } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.canAccessFiles).toBe(true);
    expect(body.data.canDownload).toBe(true);
    expect(body.data.purchasePrice).toBe(testScore.purchasePrice);
    expect(body.data.purchaseCount).toBe(5);
    expect(body.data.hasCollection).toBe(true);
    expect(body.data.files).toHaveLength(1);
  });

  it("tech/conductor: ファイルアクセス・DL可だがpurchasePriceは見えない", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "full_score",
          fileName: "full.pdf",
          partId: null,
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);
    vi.mocked(prisma.scorePurchase.count).mockResolvedValue(5);
    vi.mocked(prisma.collection.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.canAccessFiles).toBe(true);
    expect(body.data.canDownload).toBe(true);
    expect(body.data.purchasePrice).toBeUndefined();
    expect(body.data.purchaseCount).toBe(5);
    expect(body.data.hasCollection).toBe(false);
  });

  it("一般団員・secret: 購入記録があっても閲覧不可", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      accessLevel: "secret",
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "full_score",
          fileName: "full.pdf",
          partId: null,
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.canAccessFiles).toBe(false);
    expect(body.data.canDownload).toBe(false);
    expect(body.data.files).toEqual([]);
    expect(prisma.scorePurchase.findFirst).not.toHaveBeenCalled();
  });

  it("一般団員・非secret・購入記録あり: 閲覧可・DL可", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      accessLevel: "restricted",
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "full_score",
          fileName: "full.pdf",
          partId: null,
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue({ id: "purchase-1" } as any);
    vi.mocked(prisma.part.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.canAccessFiles).toBe(true);
    expect(body.data.canDownload).toBe(true);
    expect(body.data.purchasePrice).toBeUndefined();
    expect(body.data.purchaseCount).toBeUndefined();
    expect(body.data.files).toHaveLength(1);
  });

  it("一般団員・非secret・購入記録なし: 閲覧不可", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      accessLevel: "restricted",
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "full_score",
          fileName: "full.pdf",
          partId: null,
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.canAccessFiles).toBe(false);
    expect(body.data.files).toEqual([]);
  });

  it("パート譜: partIdからpartNameが解決される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({
      ...testScore,
      files: [
        {
          id: "file-1",
          scoreId: testScore.id,
          fileType: "part_score",
          fileName: "tenor1.pdf",
          partId: "part-1",
          version: 1,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.part.findMany).mockResolvedValue([
      { id: "part-1", orgId: "org-1", name: "Tenor I", sortOrder: 1 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.files[0].partId).toBe("part-1");
    expect(body.data.files[0].partName).toBe("Tenor I");
  });
});

describe("POST /scores", () => {
  it("バリデーションエラー: title空は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["score"]));
    const res = await app.request("/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新曲" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常（admin）: 201を返し楽譜が作成される", async () => {
    vi.mocked(prisma.score.create).mockResolvedValue({
      ...testScore,
      id: "score-new",
      title: "新曲",
      composer: null,
      arranger: null,
    });

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新曲" }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "score-new",
      title: "新曲",
      composer: null,
      arranger: null,
    });
    expect(prisma.score.create).toHaveBeenCalledWith({
      data: {
        orgId: testOrg.id,
        title: "新曲",
        composer: null,
        arranger: null,
        isCommissioned: false,
        purchaseDate: null,
        distributionStart: null,
        purchasePrice: null,
        notes: null,
      },
    });
  });
});

describe("PATCH /scores/:scoreId", () => {
  it("バリデーションエラー: titleが空文字は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("score+以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "メモ" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/scores/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "メモ" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("scoreロール: admin限定フィールド（title等）を送っても無視され、他フィールドは反映される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.score.update).mockResolvedValue({
      id: testScore.id,
      title: testScore.title,
      composer: testScore.composer,
      arranger: testScore.arranger,
      accessLevel: testScore.accessLevel,
      isCommissioned: testScore.isCommissioned,
      purchaseDate: null,
      distributionStart: null,
      purchasePrice: 999,
      notes: testScore.notes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "不正な変更", purchasePrice: 999 }),
    });

    expect(res.status).toBe(200);
    expect(prisma.score.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: testScore.id },
        data: { purchasePrice: 999 },
      }),
    );
  });

  it("admin: 全フィールドが反映される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.score.update).mockResolvedValue({
      id: testScore.id,
      title: "改訂版",
      composer: "新作曲家",
      arranger: "新編曲家",
      accessLevel: "public",
      isCommissioned: true,
      purchaseDate: new Date("2026-10-01"),
      distributionStart: null,
      purchasePrice: 1500,
      notes: "改訂",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "改訂版",
        composer: "新作曲家",
        arranger: "新編曲家",
        accessLevel: "public",
        isCommissioned: true,
        purchaseDate: "2026-10-01",
        purchasePrice: 1500,
        notes: "改訂",
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.title).toBe("改訂版");
    expect(body.data.accessLevel).toBe("public");
    expect(body.data.purchaseDate).toBe("2026-10-01");
    expect(prisma.score.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: testScore.id },
        data: expect.objectContaining({
          title: "改訂版",
          composer: "新作曲家",
          arranger: "新編曲家",
          accessLevel: "public",
          isCommissioned: true,
          purchasePrice: 1500,
          notes: "改訂",
        }),
      }),
    );
  });

  it("scoreロール: admin限定フィールドのみ送信すると更新自体が呼ばれず{id}のみ返る", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "不正な変更", accessLevel: "public" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: testScore.id });
    expect(prisma.score.update).not.toHaveBeenCalled();
  });
});

describe("GET /scores/:scoreId/purchases", () => {
  it("score+以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/purchases`);

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request("/scores/nonexistent/purchases");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 購入者一覧を返し、guest/visitorを除外するクエリになっている", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scorePurchase.findMany).mockResolvedValue([
      {
        memberId: "member-2",
        purchasedAt: new Date("2025-10-20"),
        note: null,
        createdAt: new Date("2025-10-20T10:00:00Z"),
        member: { userRef: { nameJa: "山田 太郎" }, part: { name: "Tenor I" } },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/purchases`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      {
        memberId: "member-2",
        nameJa: "山田 太郎",
        partName: "Tenor I",
        purchasedAt: "2025-10-20",
        note: null,
        createdAt: "2025-10-20T10:00:00.000Z",
      },
    ]);
    expect(prisma.scorePurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scoreId: testScore.id,
          member: { NOT: { roles: { hasSome: ["guest", "visitor"] } } },
        }),
      }),
    );
  });
});

describe("PUT /scores/:scoreId/purchases", () => {
  it("バリデーションエラー: memberIdsが配列でない場合は400を返す", async () => {
    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/purchases`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: "not-an-array" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("score+以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/purchases`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [] }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request("/scores/nonexistent/purchases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [] }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他団体のメンバーIDが含まれる: 400 BAD_REQUESTを返し作成処理は走らない", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([{ id: "member-2" }] as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/purchases`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: ["member-2", "other-org-member"] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.scorePurchase.create).not.toHaveBeenCalled();
  });

  it("正常: 全置換される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-2" },
      { id: "member-3" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scorePurchase.create).mockResolvedValue({} as any);

    const actingMember = makeMember(["score"], "member-recorder");
    const app = createTestApp(actingMember);
    const res = await app.request(`/scores/${testScore.id}/purchases`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberIds: ["member-2", "member-3"],
        purchasedAt: "2026-10-01",
        note: "10月配布分",
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ updated: 2 });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.scorePurchase.create).toHaveBeenCalledTimes(2);
    expect(prisma.scorePurchase.create).toHaveBeenCalledWith({
      data: {
        scoreId: testScore.id,
        memberId: "member-2",
        purchasedAt: new Date("2026-10-01"),
        note: "10月配布分",
        recordedById: actingMember.id,
      },
    });
  });

  it("memberIds空配列: 既存の購入記録が全削除されupdated:0を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/purchases`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [] }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ updated: 0 });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.scorePurchase.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /scores/:scoreId/price", () => {
  it("バリデーションエラー: 負の数は400を返す", async () => {
    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: -100 }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("score+以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 500 }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request("/scores/nonexistent/price", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 500 }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 価格を設定する", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.score.update).mockResolvedValue({
      id: testScore.id,
      distributionPrice: 500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 500 }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: testScore.id, distributionPrice: 500 });
    expect(prisma.score.update).toHaveBeenCalledWith({
      where: { id: testScore.id },
      data: { distributionPrice: 500 },
      select: { id: true, distributionPrice: true },
    });
  });

  it("正常: nullで未設定に戻す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.score.update).mockResolvedValue({
      id: testScore.id,
      distributionPrice: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: null }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ id: testScore.id, distributionPrice: null });
  });
});

describe("POST /scores/:scoreId/files/presign", () => {
  it("バリデーションエラー: fileNameが空は400を返す", async () => {
    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request("/scores/nonexistent/files/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "a.pdf",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("MIDI: tech+以外は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileType: "midi", fileName: "a.mid", contentType: "audio/midi" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("full_score: score+以外は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "a.pdf",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("partIdが別テナント: 400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-1",
      orgId: "other-org",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "a.pdf",
        partId: "part-1",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: full_scoreにpdf以外は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "a.docx",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: midiに対象外拡張子は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "midi",
        fileName: "a.wav",
        contentType: "audio/wav",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: otherに対象外拡張子は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "other",
        fileName: "a.docx",
        contentType: "application/octet-stream",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("full_score重複: 409を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue({ id: "existing-file" } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "a.pdf",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("正常: presignedUrlとkeyを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue(null);
    vi.mocked(storage.getPresignedPutUrl).mockResolvedValue("https://r2.example.com/presigned");

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: "full_score",
        fileName: "a.pdf",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.presignedUrl).toBe("https://r2.example.com/presigned");
    expect(body.data.key).toMatch(/^scores\/.+\.pdf$/);
  });
});

describe("POST /scores/:scoreId/files/confirm", () => {
  it("バリデーションエラー: keyの形式が不正は400を返す", async () => {
    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "invalid-key", fileType: "full_score", fileName: "a.pdf" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request("/scores/nonexistent/files/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.pdf", fileType: "full_score", fileName: "a.pdf" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("MIDI: tech+以外は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.mid", fileType: "midi", fileName: "a.mid" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("full_score: score+以外は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.pdf", fileType: "full_score", fileName: "a.pdf" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("partIdが別テナント: 400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.part.findUnique).mockResolvedValue({
      id: "part-1",
      orgId: "other-org",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "scores/abc.pdf",
        fileType: "full_score",
        fileName: "a.pdf",
        partId: "part-1",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: full_scoreにpdf以外は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.docx", fileType: "full_score", fileName: "a.docx" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: midiに対象外拡張子は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.wav", fileType: "midi", fileName: "a.wav" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: otherに対象外拡張子は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.docx", fileType: "other", fileName: "a.docx" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("full_score重複: 409を返しR2上のファイルも削除される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.aggregate).mockResolvedValue({ _max: { version: null } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue({ id: "existing-file" } as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.pdf", fileType: "full_score", fileName: "a.pdf" }),
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
    expect(storage.delete).toHaveBeenCalledWith("scores/abc.pdf");
  });

  it("正常: 201を返しファイルが登録される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.aggregate).mockResolvedValue({ _max: { version: 1 } } as any);
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.scoreFile.create).mockResolvedValue({
      id: "file-1",
      fileType: "full_score",
      fileName: "a.pdf",
      partId: null,
      version: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["score"], "member-1"));
    const res = await app.request(`/scores/${testScore.id}/files/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "scores/abc.pdf", fileType: "full_score", fileName: "a.pdf" }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "file-1",
      fileType: "full_score",
      fileName: "a.pdf",
      partId: null,
      partName: null,
      version: 2,
      downloadUrl: `/api/v1/${testOrg.slug}/scores/${testScore.id}/files/file-1/download`,
    });
    expect(prisma.scoreFile.create).toHaveBeenCalledWith({
      data: {
        scoreId: testScore.id,
        fileType: "full_score",
        partId: null,
        storageKey: "scores/abc.pdf",
        fileName: "a.pdf",
        version: 2,
        uploadedBy: "member-1",
      },
    });
  });
});

describe("POST /scores/:scoreId/files（フォールバックアップロード）", () => {
  it("ファイル未選択: 400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("fileType", "full_score");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("MIDI: tech+以外は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.mid", { type: "audio/midi" }));
    fd.append("fileType", "midi");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("full_score重複（アップロード前チェック）: 409を返しuploadは呼ばれない", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue({ id: "existing-file" } as any);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.pdf", { type: "application/pdf" }));
    fd.append("fileType", "full_score");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("拡張子不一致: full_scoreにpdf以外は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.docx", { type: "application/octet-stream" }));
    fd.append("fileType", "full_score");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: midiに対象外拡張子は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);

    const app = createTestApp(makeMember(["tech"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.wav", { type: "audio/wav" }));
    fd.append("fileType", "midi");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: otherに対象外拡張子は400を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.docx", { type: "application/octet-stream" }));
    fd.append("fileType", "other");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ファイルサイズ超過: 400 FILE_TOO_LARGEを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["score"]));
    const bigContent = new Uint8Array(21 * 1024 * 1024);
    const fd = new FormData();
    fd.append("file", new File([bigContent], "big.pdf", { type: "application/pdf" }));
    fd.append("fileType", "full_score");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("正常: 201を返しファイルがアップロード・登録される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findFirst).mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.aggregate).mockResolvedValue({ _max: { version: null } } as any);
    vi.mocked(storage.upload).mockResolvedValue(undefined);
    vi.mocked(prisma.scoreFile.create).mockResolvedValue({
      id: "file-1",
      fileType: "full_score",
      fileName: "a.pdf",
      partId: null,
      version: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.pdf", { type: "application/pdf" }));
    fd.append("fileType", "full_score");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.id).toBe("file-1");
    expect(storage.upload).toHaveBeenCalled();
    expect(prisma.scoreFile.create).toHaveBeenCalled();
  });

  it("full_score重複（アップロード後の競合再チェック）: 409を返しR2上のファイルを削除する", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findFirst)
      .mockResolvedValueOnce(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ id: "concurrently-uploaded-file" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.aggregate).mockResolvedValue({ _max: { version: null } } as any);
    vi.mocked(storage.upload).mockResolvedValue(undefined);
    vi.mocked(storage.delete).mockResolvedValue(undefined);

    const app = createTestApp(makeMember(["score"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.pdf", { type: "application/pdf" }));
    fd.append("fileType", "full_score");
    const res = await app.request(`/scores/${testScore.id}/files`, { method: "POST", body: fd });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
    expect(storage.upload).toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalled();
    expect(prisma.scoreFile.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /scores/:scoreId/files/:fileId", () => {
  it("楽譜が存在しない: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("ファイルが存在しない: 404を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("MIDIファイル: MIDI権限なし（member）は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeScoreFile({ fileType: "midi" }) as any,
    );

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("MIDIファイル: PDF権限のみ（score）は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeScoreFile({ fileType: "midi" }) as any,
    );

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("MIDIファイル: MIDI権限あり（tech）は204を返しファイルが削除される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile({ fileType: "midi" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    vi.mocked(storage.delete).mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.delete).mockResolvedValue(file as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(storage.delete).toHaveBeenCalledWith(file.storageKey);
    expect(prisma.scoreFile.delete).toHaveBeenCalledWith({
      where: { id: "file-1", scoreId: testScore.id },
    });
  });

  it("PDF等ファイル: PDF権限なし（tech）は403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(makeScoreFile() as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("PDF等ファイル: PDF権限あり（score）は204を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    vi.mocked(storage.delete).mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.delete).mockResolvedValue(file as any);

    const app = createTestApp(makeMember(["score"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });
});

describe("GET /scores/:scoreId/files/:fileId/download", () => {
  it("楽譜が存在しない: 404のHTMLを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("ファイルが存在しない: 404のHTMLを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("visitor: full_scoreは200を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    vi.mocked(storage.getScoreDownload).mockResolvedValue({
      type: "buffer",
      data: Buffer.from("dummy"),
      contentType: "application/pdf",
      disposition: "inline; filename*=UTF-8''%E6%A5%BD%E8%AD%9C.pdf",
    });

    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(200);
  });

  it("visitor: full_score以外（midi）は403のHTMLを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeScoreFile({ fileType: "midi" }) as any,
    );

    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("非特権メンバー: secretは購入記録を確認せず403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({ ...testScore, accessLevel: "secret" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(makeScoreFile() as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(403);
    expect(prisma.scorePurchase.findFirst).not.toHaveBeenCalled();
  });

  it("非特権メンバー: public/restrictedで購入記録なしは403を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(makeScoreFile() as any);
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("非特権メンバー: public/restrictedで購入記録ありは200を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue({ id: "purchase-1" } as any);
    vi.mocked(storage.getScoreDownload).mockResolvedValue({
      type: "buffer",
      data: Buffer.from("dummy"),
      contentType: "application/pdf",
      disposition: "inline; filename*=UTF-8''%E6%A5%BD%E8%AD%9C.pdf",
    });

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(200);
  });

  it("特権メンバー（tech）: secretでも購入記録を確認せず200を返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue({ ...testScore, accessLevel: "secret" });
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    vi.mocked(storage.getScoreDownload).mockResolvedValue({
      type: "buffer",
      data: Buffer.from("dummy"),
      contentType: "application/pdf",
      disposition: "inline; filename*=UTF-8''%E6%A5%BD%E8%AD%9C.pdf",
    });

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(200);
    expect(prisma.scorePurchase.findFirst).not.toHaveBeenCalled();
  });

  it("ストレージ上にファイルが存在しない: 404のHTMLを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue({ id: "purchase-1" } as any);
    vi.mocked(storage.getScoreDownload).mockRejectedValue(new Error("not found"));

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("R2設定時: 302リダイレクトを返す", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue({ id: "purchase-1" } as any);
    vi.mocked(storage.getScoreDownload).mockResolvedValue({
      type: "redirect",
      url: "https://r2.example.com/signed-url",
    });

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`, {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://r2.example.com/signed-url");
  });

  it("正常: バイナリを200で返しヘッダーが正しく設定される", async () => {
    vi.mocked(prisma.score.findUnique).mockResolvedValue(testScore);
    const file = makeScoreFile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scoreFile.findUnique).mockResolvedValue(file as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.scorePurchase.findFirst).mockResolvedValue({ id: "purchase-1" } as any);
    const data = Buffer.from("dummy-pdf-content");
    vi.mocked(storage.getScoreDownload).mockResolvedValue({
      type: "buffer",
      data,
      contentType: "application/pdf",
      disposition: "inline; filename*=UTF-8''%E6%A5%BD%E8%AD%9C.pdf",
    });

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/scores/${testScore.id}/files/file-1/download`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      "inline; filename*=UTF-8''%E6%A5%BD%E8%AD%9C.pdf",
    );
    expect(res.headers.get("content-length")).toBe(String(data.length));
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
  });
});
