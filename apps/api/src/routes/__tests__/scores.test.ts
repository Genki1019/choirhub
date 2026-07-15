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
    part: { findMany: vi.fn() },
    scorePurchase: { findFirst: vi.fn(), count: vi.fn() },
    collection: { findFirst: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
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
