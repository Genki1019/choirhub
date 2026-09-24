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
    storedFile: { findMany: vi.fn() },
    scorePurchase: { findMany: vi.fn() },
  },
}));

vi.mock("../../services/storage.js", () => ({
  storage: {
    getPresignedPutUrl: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    getFileHeader: vi.fn(),
    getFileDownload: vi.fn(),
  },
  CONTENT_TYPES: { ".pdf": "application/pdf" },
}));

import { prisma } from "../../lib/prisma.js";
import { filesRouter } from "../files.js";

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

const makeMember = (roles: string[], id = "member-1", partId: string | null = null): Member => ({
  id,
  userId: `user-${id}`,
  orgId: "org-1",
  partId,
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

function makeScoreRow(overrides: Partial<Record<string, unknown>> = {}) {
  const {
    scoreFileOverrides,
    scoreOverrides,
    ...rest
  }: {
    scoreFileOverrides?: Record<string, unknown>;
    scoreOverrides?: Record<string, unknown>;
  } = overrides;
  return {
    id: "stored-score-1",
    fileName: "full.pdf",
    uploadedAt: new Date("2024-01-01"),
    scoreFile: {
      id: "sf-1",
      scoreId: "score-1",
      fileType: "full_score",
      score: { id: "score-1", title: "楽譜A", accessLevel: "restricted", ...scoreOverrides },
      ...scoreFileOverrides,
    },
    concertFile: null,
    eventFile: null,
    ...rest,
  };
}

function makeConcertRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "stored-concert-1",
    fileName: "flyer.pdf",
    uploadedAt: new Date("2024-01-01"),
    scoreFile: null,
    concertFile: {
      id: "cf-1",
      concertId: "concert-1",
      label: "フライヤー",
      concert: { id: "concert-1", title: "第20回定期演奏会" },
    },
    eventFile: null,
    ...overrides,
  };
}

function makeEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  const {
    eventFileOverrides,
    eventOverrides,
    ...rest
  }: {
    eventFileOverrides?: Record<string, unknown>;
    eventOverrides?: Record<string, unknown>;
  } = overrides;
  return {
    id: "stored-event-1",
    fileName: "itinerary.pdf",
    uploadedAt: new Date("2024-01-01"),
    scoreFile: null,
    concertFile: null,
    eventFile: {
      id: "ef-1",
      eventId: "event-1",
      label: "行程表",
      event: {
        id: "event-1",
        title: "第12回定期練習",
        targetRoles: [],
        targetPartIds: [],
        ...eventOverrides,
      },
      ...eventFileOverrides,
    },
    ...rest,
  };
}

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", filesRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /files", () => {
  it("不正なkindは400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/files?kind=invalid");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("kind未指定時はscore/concert/eventの3種でwhereを構築する", async () => {
    vi.mocked(prisma.storedFile.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/files");

    expect(prisma.storedFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id, kind: { in: ["score", "concert", "event"] } },
      }),
    );
  });

  it("kind指定時はそのkindのみでwhereを構築する", async () => {
    vi.mocked(prisma.storedFile.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["admin"]));
    await app.request("/files?kind=concert");

    expect(prisma.storedFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id, kind: "concert" },
      }),
    );
  });

  describe("楽譜の可視性", () => {
    it("admin: secretな楽譜も見える", async () => {
      const row = makeScoreRow({ scoreOverrides: { accessLevel: "secret" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["admin"]));
      const res = await app.request("/files?kind=score");

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(prisma.scorePurchase.findMany).not.toHaveBeenCalled();
    });

    it("一般団員: 購入記録がなければrestrictedな楽譜は見えない", async () => {
      const row = makeScoreRow();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);
      vi.mocked(prisma.scorePurchase.findMany).mockResolvedValue([]);

      const app = createTestApp(makeMember(["member"]));
      const res = await app.request("/files?kind=score");

      const body = await json(res);
      expect(body.data).toHaveLength(0);
    });

    it("一般団員: 購入記録があればrestrictedな楽譜が見える", async () => {
      const row = makeScoreRow();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.scorePurchase.findMany).mockResolvedValue([{ scoreId: "score-1" }] as any);

      const app = createTestApp(makeMember(["member"]));
      const res = await app.request("/files?kind=score");

      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: "stored-score-1",
        kind: "score",
        title: "楽譜A",
        subtitle: "楽譜PDF",
        fileName: "full.pdf",
        downloadUrl: `/api/v1/${testOrg.slug}/scores/score-1/files/sf-1/download`,
        resourceLink: `/${testOrg.slug}/scores/score-1`,
      });
    });

    it("一般団員: 購入記録があってもsecretな楽譜は見えない", async () => {
      const row = makeScoreRow({ scoreOverrides: { accessLevel: "secret" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["member"]));
      const res = await app.request("/files?kind=score");

      const body = await json(res);
      expect(body.data).toHaveLength(0);
      // secret楽譜は購入照会の対象からも除外され、無駄なクエリも発生しない
      expect(prisma.scorePurchase.findMany).not.toHaveBeenCalled();
    });

    it("visitor: full_scoreのみ見える（購入記録は問わない）", async () => {
      const fullScoreRow = makeScoreRow({
        id: "stored-full",
        scoreFileOverrides: { id: "sf-full", fileType: "full_score" },
      });
      const midiRow = makeScoreRow({
        id: "stored-midi",
        scoreFileOverrides: { id: "sf-midi", fileType: "midi" },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([fullScoreRow, midiRow] as any);

      const app = createTestApp(makeMember(["visitor"]));
      const res = await app.request("/files?kind=score");

      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].subtitle).toBe("楽譜PDF");
    });
  });

  describe("本番添付ファイルの可視性", () => {
    it("visitorでも本番添付ファイルは見える", async () => {
      const row = makeConcertRow();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["visitor"]));
      const res = await app.request("/files?kind=concert");

      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: "stored-concert-1",
        kind: "concert",
        title: "フライヤー",
        subtitle: "第20回定期演奏会",
        fileName: "flyer.pdf",
        downloadUrl: `/api/v1/${testOrg.slug}/concerts/concert-1/files/cf-1/download`,
        resourceLink: `/${testOrg.slug}/concerts/concert-1`,
      });
    });
  });

  describe("イベント添付ファイルの可視性", () => {
    it("targetRoles指定なしのイベントは全員見える", async () => {
      const row = makeEventRow();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["member"]));
      const res = await app.request("/files?kind=event");

      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: "stored-event-1",
        kind: "event",
        title: "行程表",
        subtitle: "第12回定期練習",
        fileName: "itinerary.pdf",
        downloadUrl: `/api/v1/${testOrg.slug}/events/event-1/files/ef-1/download`,
        resourceLink: `/${testOrg.slug}/schedule/event-1`,
      });
    });

    it("targetRolesに含まれないロールのメンバーには見えない", async () => {
      const row = makeEventRow({ eventOverrides: { targetRoles: ["conductor"] } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["member"]));
      const res = await app.request("/files?kind=event");

      const body = await json(res);
      expect(body.data).toHaveLength(0);
    });

    it("targetRolesに含まれるロールのメンバーには見える", async () => {
      const row = makeEventRow({ eventOverrides: { targetRoles: ["conductor"] } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["conductor"]));
      const res = await app.request("/files?kind=event");

      const body = await json(res);
      expect(body.data).toHaveLength(1);
    });

    it("adminはtargetRolesに含まれなくても見える（events.tsのcanViewと同じisAdminバイパス）", async () => {
      const row = makeEventRow({ eventOverrides: { targetRoles: ["ticket"] } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.storedFile.findMany).mockResolvedValue([row] as any);

      const app = createTestApp(makeMember(["admin"]));
      const res = await app.request("/files?kind=event");

      const body = await json(res);
      expect(body.data).toHaveLength(1);
    });
  });
});
