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
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eventCategory: { findFirst: vi.fn(), findUnique: vi.fn() },
    attendance: { findMany: vi.fn(), upsert: vi.fn() },
    concert: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    onStageAssignment: { findMany: vi.fn() },
    member: { findMany: vi.fn(), findUnique: vi.fn() },
    collection: { create: vi.fn() },
    collectionPayment: { create: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { eventsRouter } from "../events.js";

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
  defaultFeeAmount: 500,
  visitorFormToken: null,
  visitorIntroSubjectTemplate: "見学者のご紹介",
  visitorIntroBodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
  visitorIntroLineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
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
  calendarFeedToken: null,
  createdAt: new Date("2022-04-01"),
});

const testCategory = {
  id: "category-1",
  orgId: "org-1",
  name: "練習",
  slug: "rehearsal",
  color: "#3B82F6",
  sortOrder: 1,
  createdAt: new Date("2024-01-01"),
};

const testEvent = {
  id: "event-1",
  orgId: "org-1",
  title: "第12回定期練習",
  categoryId: "category-1",
  startsAt: new Date("2026-06-10T09:30:00Z"),
  endsAt: new Date("2026-06-10T12:00:00Z"),
  location: "○○公民館",
  locationUrl: null,
  deadline: null,
  rehearsalContent: null,
  timeSchedule: null,
  practiceVenue: null,
  otherNotes: null,
  isLocked: false,
  targetRoles: [],
  targetPartIds: [],
  concertId: null,
  category: testCategory,
};

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", eventsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /events", () => {
  it("バリデーションエラー: fromが不正な日付形式は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events?from=invalid-date");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("typeに該当する区分が無い場合: 空配列を返しConcertマージも行われない", async () => {
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events?type=nonexistent");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
    expect(prisma.concert.findMany).not.toHaveBeenCalled();
  });

  it("非admin: isInvitedでフィルタされる", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { ...testEvent, id: "event-invited", targetRoles: [], targetPartIds: [] },
      { ...testEvent, id: "event-not-invited", targetRoles: ["tech"], targetPartIds: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.onStageAssignment.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.map((e: { id: string }) => e.id)).toEqual(["event-invited"]);
  });

  it("admin: 招待対象外のイベントも含め全件見える", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { ...testEvent, id: "event-invited", targetRoles: [], targetPartIds: [] },
      { ...testEvent, id: "event-not-invited", targetRoles: ["tech"], targetPartIds: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.onStageAssignment.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.map((e: { id: string }) => e.id)).toEqual([
      "event-invited",
      "event-not-invited",
    ]);
  });

  it("正常: targetRolesとtargetPartIdsが空配列の場合レスポンスではnullになる", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { ...testEvent, targetRoles: [], targetPartIds: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.concert.findMany).mockResolvedValue([]);
    vi.mocked(prisma.onStageAssignment.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0].targetRoles).toBeNull();
    expect(body.data[0].targetPartIds).toBeNull();
  });

  it("type未指定: スケジュール未連携の演奏会がマージされmyAttendanceはオンステ確定で決まる", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(testCategory);
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        heldOn: new Date("2026-11-23T00:00:00Z"),
        venue: "○○ホール",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.onStageAssignment.findMany).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { concertId: "concert-1" } as any,
    ]);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/events");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        id: "concert-1",
        concertId: "concert-1",
        myAttendance: "attending",
      }),
    );
  });

  it("type=rehearsal指定: 演奏会マージがスキップされる", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(testCategory);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events?type=rehearsal");

    expect(res.status).toBe(200);
    expect(prisma.concert.findMany).not.toHaveBeenCalled();
  });

  it("正常: イベントと演奏会がstartsAt昇順でマージソートされる", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { ...testEvent, id: "event-late", startsAt: new Date("2026-12-01T00:00:00Z") },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(testCategory);
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      {
        id: "concert-early",
        title: "早い演奏会",
        heldOn: new Date("2026-11-01T00:00:00Z"),
        venue: null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.onStageAssignment.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events");

    const body = await json(res);
    expect(body.data.map((e: { id: string }) => e.id)).toEqual(["concert-early", "event-late"]);
  });
});

describe("POST /events", () => {
  it("バリデーションエラー: 必須項目欠如は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech未満（member）: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "新イベント",
        categoryId: "ccategoryone",
        startsAt: "2026-06-20T18:00:00+09:00",
        endsAt: "2026-06-20T20:00:00+09:00",
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("イベント区分が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.eventCategory.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "新イベント",
        categoryId: "cnonexistent",
        startsAt: "2026-06-20T18:00:00+09:00",
        endsAt: "2026-06-20T20:00:00+09:00",
      }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（categoryのslugがconcert）: Concertも自動作成されリンクされる", async () => {
    vi.mocked(prisma.eventCategory.findUnique).mockResolvedValue({
      ...testCategory,
      slug: "concert",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.create).mockResolvedValue({ id: "concert-new" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-new" } as any);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      ...testEvent,
      id: "event-new",
      concertId: "concert-new",
      category: { ...testCategory, slug: "concert" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "第21回定期演奏会",
        categoryId: "ccategoryone",
        startsAt: "2026-11-23T00:00:00+09:00",
        endsAt: "2026-11-23T03:00:00+09:00",
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.concertId).toBe("concert-new");
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: testOrg.id }) }),
    );
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ concertId: "concert-new" }) }),
    );
  });

  it("正常（rehearsal区分・per_rehearsal・defaultFeeAmountあり）: guest/visitor除くメンバー全員に徴収が生成される", async () => {
    vi.mocked(prisma.eventCategory.findUnique).mockResolvedValue(testCategory);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-new" } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-1", memberType: null },
      { id: "member-2", memberType: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collection.create).mockResolvedValue({ id: "collection-1" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.collectionPayment.create).mockResolvedValue({} as any);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      id: "event-new",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"], "creator-1"));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "定期練習",
        categoryId: "ccategoryone",
        startsAt: "2026-06-20T18:00:00+09:00",
        endsAt: "2026-06-20T20:00:00+09:00",
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: testOrg.id, status: "active" }),
      }),
    );
    expect(prisma.collection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: testOrg.defaultFeeAmount, eventId: "event-new" }),
      }),
    );
    expect(prisma.collectionPayment.create).toHaveBeenCalledTimes(2);
  });

  it("正常（rehearsal区分だがdefaultFeeAmount未設定）: 徴収は生成されない", async () => {
    vi.mocked(prisma.eventCategory.findUnique).mockResolvedValue(testCategory);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-new" } as any);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      id: "event-new",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const orgNoFee = { ...testOrg, defaultFeeAmount: null };
    const app = new Hono<TenantEnv>();
    app.use("*", (c, next) => {
      c.set("org", orgNoFee);
      c.set("member", makeMember(["tech"]));
      return next();
    });
    app.route("/", eventsRouter);

    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "定期練習",
        categoryId: "ccategoryone",
        startsAt: "2026-06-20T18:00:00+09:00",
        endsAt: "2026-06-20T20:00:00+09:00",
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.member.findMany).not.toHaveBeenCalled();
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it("正常（対象メンバー0件）: collection.createは呼ばれない", async () => {
    vi.mocked(prisma.eventCategory.findUnique).mockResolvedValue(testCategory);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-new" } as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      id: "event-new",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "定期練習",
        categoryId: "ccategoryone",
        startsAt: "2026-06-20T18:00:00+09:00",
        endsAt: "2026-06-20T20:00:00+09:00",
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it("正常: 構造化備考フィールド（練習内容・タイムスケジュール・練習会場・その他備考）が保存される", async () => {
    const noteFields = {
      rehearsalContent: "新曲『○○』の初見合わせ",
      timeSchedule: "18:00 集合 / 18:15 発声",
      practiceVenue: "3階 大会議室",
      otherNotes: "個人ボイトレ希望者は事前連絡",
    };

    vi.mocked(prisma.eventCategory.findUnique).mockResolvedValue(testCategory);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-new" } as any);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      id: "event-new",
      ...noteFields,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const orgNoFee = { ...testOrg, defaultFeeAmount: null };
    const app = new Hono<TenantEnv>();
    app.use("*", (c, next) => {
      c.set("org", orgNoFee);
      c.set("member", makeMember(["tech"]));
      return next();
    });
    app.route("/", eventsRouter);

    const res = await app.request("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "定期練習",
        categoryId: "ccategoryone",
        startsAt: "2026-06-20T18:00:00+09:00",
        endsAt: "2026-06-20T20:00:00+09:00",
        ...noteFields,
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual(expect.objectContaining(noteFields));
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining(noteFields) }),
    );
  });
});

describe("GET /events/:id", () => {
  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("招待対象外（非admin）: 403 NOT_INVITEDを返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      targetRoles: ["tech"],
      attendances: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_INVITED");
  });

  it("正常（admin）: 全出欠が返りsummaryが集計される", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      targetRoles: ["tech"],
      attendances: [
        {
          status: "attending",
          arriveTime: null,
          leaveTime: null,
          dayMemo: null,
          member: {
            id: "member-1",
            roles: ["member"],
            userRef: { nameJa: "山田 太郎" },
            part: { id: "part-1", name: "Tenor I", sortOrder: 1, voiceType: "tenor" },
          },
        },
        {
          status: "absent",
          arriveTime: null,
          leaveTime: null,
          dayMemo: null,
          member: {
            id: "member-2",
            roles: ["tech"],
            userRef: { nameJa: "鈴木 次郎" },
            part: null,
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events/event-1");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.invitedCount).toBe(2);
    expect(body.data.summary).toEqual({ attending: 1, absent: 1, maybe: 0, undecided: 0 });
  });

  it("正常（一般・招待対象）: 招待対象メンバーの出欠のみ返る", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      targetRoles: ["tech"],
      attendances: [
        {
          status: "attending",
          arriveTime: null,
          leaveTime: null,
          dayMemo: null,
          member: {
            id: "member-tech",
            roles: ["tech"],
            partId: null,
            userRef: { nameJa: "技術係" },
            part: null,
          },
        },
        {
          status: "absent",
          arriveTime: null,
          leaveTime: null,
          dayMemo: null,
          member: {
            id: "member-general",
            roles: ["member"],
            partId: null,
            userRef: { nameJa: "一般団員" },
            part: null,
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["tech"], "member-tech"));
    const res = await app.request("/events/event-1");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.attendances).toHaveLength(1);
    expect(body.data.attendances[0].member.id).toBe("member-tech");
  });

  it("正常: guest/visitorの出欠はattendancesから除外される", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      targetRoles: [],
      attendances: [
        {
          status: "attending",
          arriveTime: null,
          leaveTime: null,
          dayMemo: null,
          member: {
            id: "member-1",
            roles: ["member"],
            partId: null,
            userRef: { nameJa: "山田 太郎" },
            part: null,
          },
        },
        {
          status: "attending",
          arriveTime: null,
          leaveTime: null,
          dayMemo: null,
          member: {
            id: "member-visitor",
            roles: ["visitor"],
            partId: null,
            userRef: { nameJa: "体験アカウント" },
            part: null,
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events/event-1");

    const body = await json(res);
    expect(body.data.attendances.map((a: { member: { id: string } }) => a.member.id)).toEqual([
      "member-1",
    ]);
  });
});

describe("PATCH /events/:id", () => {
  it("バリデーションエラー: titleが空文字は400を返す", async () => {
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("tech未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 一般フィールドが更新される", async () => {
    vi.mocked(prisma.event.findUnique)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(testEvent as any)
      .mockResolvedValueOnce({
        ...testEvent,
        title: "改題後",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題後" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.title).toBe("改題後");
    expect(prisma.concert.update).not.toHaveBeenCalled();
  });

  it("正常（concertIdあり）: Concert側にも同期更新される", async () => {
    vi.mocked(prisma.event.findUnique)
      .mockResolvedValueOnce({
        ...testEvent,
        concertId: "concert-1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .mockResolvedValueOnce({
        ...testEvent,
        concertId: "concert-1",
        title: "改題後",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.update).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "改題後", location: "△△ホール" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.concert.update).toHaveBeenCalledWith({
      where: { id: "concert-1", orgId: testOrg.id },
      data: { title: "改題後", venue: "△△ホール" },
    });
  });

  it("正常: 構造化備考フィールドが更新される", async () => {
    const noteFields = {
      rehearsalContent: "新曲『○○』の初見合わせ",
      timeSchedule: "18:00 集合 / 18:15 発声",
      practiceVenue: "3階 大会議室",
      otherNotes: "個人ボイトレ希望者は事前連絡",
    };

    vi.mocked(prisma.event.findUnique)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(testEvent as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ ...testEvent, ...noteFields } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteFields),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual(expect.objectContaining(noteFields));
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining(noteFields) }),
    );
  });
});

describe("DELETE /events/:id", () => {
  it("tech未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1", { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/nonexistent", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（concertIdあり）: EventとConcertの両方が削除される", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      concertId: "concert-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.delete).mockResolvedValue({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/event-1", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: "event-1" } });
    expect(prisma.concert.delete).toHaveBeenCalledWith({ where: { id: "concert-1" } });
  });

  it("正常（concertIdなし）: concert.deleteは呼ばれない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.findUnique).mockResolvedValue(testEvent as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/events/event-1", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.concert.delete).not.toHaveBeenCalled();
  });
});

describe("PUT /events/:id/attendance/me", () => {
  it("バリデーションエラー: statusが不正な値は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1/attendance/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/nonexistent/attendance/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("招待対象外（非admin）: 403 NOT_INVITEDを返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      targetRoles: ["tech"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1/attendance/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_INVITED");
  });

  it("締切済み（isLocked:true）: 403 LOCKEDを返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      isLocked: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1/attendance/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("LOCKED");
  });

  it("正常: 自分の出欠を登録・更新する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.findUnique).mockResolvedValue(testEvent as any);
    vi.mocked(prisma.attendance.upsert).mockResolvedValue({
      status: "maybe",
      arriveTime: "19:00",
      leaveTime: null,
      dayMemo: "少し遅れます",
      updatedAt: new Date("2026-06-05T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/events/event-1/attendance/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "maybe", arriveTime: "19:00", dayMemo: "少し遅れます" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({
      status: "maybe",
      arriveTime: "19:00",
      leaveTime: null,
      dayMemo: "少し遅れます",
      updatedAt: "2026-06-05T10:00:00.000Z",
    });
    expect(prisma.attendance.upsert).toHaveBeenCalledWith({
      where: { eventId_memberId: { eventId: "event-1", memberId: actingMember.id } },
      create: {
        eventId: "event-1",
        memberId: actingMember.id,
        status: "maybe",
        arriveTime: "19:00",
        dayMemo: "少し遅れます",
      },
      update: { status: "maybe", arriveTime: "19:00", dayMemo: "少し遅れます" },
    });
  });
});

describe("PATCH /events/:id/attendance/:memberId", () => {
  it("バリデーションエラー: statusが不正な値は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events/event-1/attendance/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/events/event-1/attendance/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events/nonexistent/attendance/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("対象メンバーが存在しない/別テナント: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.event.findUnique).mockResolvedValue(testEvent as any);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events/event-1/attendance/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 招待対象外のメンバーでも更新できる", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      targetRoles: ["tech"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeMember(["member"], "member-2") as any,
    );
    vi.mocked(prisma.attendance.upsert).mockResolvedValue({
      status: "attending",
      arriveTime: null,
      leaveTime: null,
      dayMemo: null,
      updatedAt: new Date("2026-06-05T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request("/events/event-1/attendance/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "attending" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.attendance.upsert).toHaveBeenCalledWith({
      where: { eventId_memberId: { eventId: "event-1", memberId: "member-2" } },
      create: { eventId: "event-1", memberId: "member-2", status: "attending" },
      update: { status: "attending" },
    });
  });

  it("正常: isLocked:trueでも更新できる（締切の影響を受けない）", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      ...testEvent,
      isLocked: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeMember(["member"], "member-2") as any,
    );
    vi.mocked(prisma.attendance.upsert).mockResolvedValue({
      status: "absent",
      arriveTime: null,
      leaveTime: null,
      dayMemo: null,
      updatedAt: new Date("2026-06-05T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/events/event-1/attendance/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "absent" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.status).toBe("absent");
  });
});
