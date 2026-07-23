import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Member, Organization } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

// RFC5545の行折り返し（CRLF + 空白）を除去し、折り返しをまたぐ文字列も検索できるようにする
function unfoldIcs(text: string): string {
  return text.replace(/\r\n /g, "");
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    member: { findFirst: vi.fn(), update: vi.fn() },
    event: { findMany: vi.fn() },
    eventCategory: { findFirst: vi.fn() },
    attendance: { findMany: vi.fn() },
    concert: { findMany: vi.fn() },
    onStageAssignment: { findMany: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { calendarRouter, handleCalendarFeed } from "../calendar.js";

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
  visitorIntroLineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
  createdAt: new Date("2024-01-01"),
};

const makeMember = (roles: string[], overrides: Partial<Member> = {}): Member => ({
  id: "member-1",
  userId: "user-1",
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
  ...overrides,
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
  rehearsalContent: "発声練習・第九第4楽章",
  timeSchedule: "18:30 集合 / 19:00 練習開始",
  practiceVenue: null,
  otherNotes: null,
  isLocked: false,
  targetRoles: [],
  targetPartIds: [],
  concertId: null,
  category: testCategory,
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────
// GET /calendar-feed-token
// ────────────────────────────

function createTenantApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", calendarRouter);
  return app;
}

describe("GET /calendar-feed-token", () => {
  it("未発行: tokenはnullを返す", async () => {
    const app = createTenantApp(makeMember(["member"]));
    const res = await app.request("/calendar-feed-token");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ token: null });
  });

  it("発行済み: 既存のtokenを返す", async () => {
    const app = createTenantApp(makeMember(["member"], { calendarFeedToken: "existing-token" }));
    const res = await app.request("/calendar-feed-token");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ token: "existing-token" });
  });
});

// ────────────────────────────
// POST /calendar-feed-token/regenerate
// ────────────────────────────

describe("POST /calendar-feed-token/regenerate", () => {
  it("未発行から新規発行される", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue(
      makeMember(["member"], { calendarFeedToken: "new-token-123" }),
    );

    const app = createTenantApp(makeMember(["member"]));
    const res = await app.request("/calendar-feed-token/regenerate", { method: "POST" });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.token).toBe("new-token-123");
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { calendarFeedToken: expect.any(String) },
    });
  });

  it("発行済みから別の値に再発行される", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue(
      makeMember(["member"], { calendarFeedToken: "regenerated-token" }),
    );

    const app = createTenantApp(makeMember(["member"], { calendarFeedToken: "old-token" }));
    const res = await app.request("/calendar-feed-token/regenerate", { method: "POST" });

    const body = await json(res);
    expect(body.data.token).toBe("regenerated-token");
    expect(body.data.token).not.toBe("old-token");
  });
});

// ────────────────────────────
// GET /api/v1/calendar/:orgSlug/feed.ics
// ────────────────────────────

describe("handleCalendarFeed", () => {
  function createPublicApp() {
    const app = new Hono();
    app.get("/public/calendar/:orgSlug/feed.ics", handleCalendarFeed);
    return app;
  }

  // GET /calendar-feed-token 系と異なり、有効なtoken前提のテストはorg/member解決後の
  // イベント取得系プリズマ呼び出しをすべてモックしておく必要があるため共通化する
  function mockValidTokenFeed(
    overrides: { member?: Partial<Member>; events?: unknown[]; concerts?: unknown[] } = {},
  ) {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    vi.mocked(prisma.member.findFirst).mockResolvedValue(
      makeMember(["member"], { calendarFeedToken: "valid-token", ...overrides.member }),
    );
    vi.mocked(prisma.event.findMany).mockResolvedValue((overrides.events ?? []) as never);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.concert.findMany).mockResolvedValue((overrides.concerts ?? []) as never);
    vi.mocked(prisma.eventCategory.findFirst).mockResolvedValue(testCategory);
    vi.mocked(prisma.onStageAssignment.findMany).mockResolvedValue([]);
  }

  it("tokenが未指定: 400を返す", async () => {
    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("存在しないorgSlug: 404を返す", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    const app = createPublicApp();
    const res = await app.request("/public/calendar/unknown-org/feed.ics?token=xxx");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("tokenに一致するメンバーがいない: 404を返す", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics?token=invalid");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("退会済み（deletedAtあり）メンバーのtoken: 404を返す", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    // deletedAt を絞り込み条件に含めているため、Prisma側で該当なし = null が返る想定
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

    const app = createPublicApp();
    const res = await app.request(
      "/public/calendar/tokyo-men-choir/feed.ics?token=deleted-member-token",
    );

    expect(res.status).toBe(404);
    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-1", calendarFeedToken: "deleted-member-token", deletedAt: null },
    });
  });

  it("正しいtoken: text/calendarでVCALENDAR/VEVENTを含むicsを返す", async () => {
    mockValidTokenFeed({ events: [testEvent] });

    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics?token=valid-token");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("UID:event-1");
    expect(text).toContain("SUMMARY:第12回定期練習");
  });

  it("招待対象外イベントは除外される", async () => {
    mockValidTokenFeed({
      member: { partId: null },
      events: [{ ...testEvent, targetRoles: ["admin"], targetPartIds: [] }],
    });

    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics?token=valid-token");

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("BEGIN:VEVENT");
  });

  it("linkedEventの無いConcertが疑似イベントとして含まれる", async () => {
    mockValidTokenFeed({
      concerts: [
        {
          id: "concert-1",
          title: "第20回定期演奏会",
          heldOn: new Date("2026-11-23T00:00:00Z"),
          venue: "○○ホール",
        },
      ],
    });

    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics?token=valid-token");

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("UID:concert-1");
    expect(text).toContain("SUMMARY:第20回定期演奏会");
  });

  it("構造化備考がDESCRIPTIONに含まれる", async () => {
    mockValidTokenFeed({ events: [testEvent] });

    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics?token=valid-token");

    expect(res.status).toBe(200);
    const text = unfoldIcs(await res.text());
    expect(text).toContain("練習内容");
    expect(text).toContain("タイムスケジュール");
  });

  it("備考が全てnullの場合はDESCRIPTIONが省略される", async () => {
    mockValidTokenFeed({
      events: [
        {
          ...testEvent,
          rehearsalContent: null,
          timeSchedule: null,
          practiceVenue: null,
          otherNotes: null,
        },
      ],
    });

    const app = createPublicApp();
    const res = await app.request("/public/calendar/tokyo-men-choir/feed.ics?token=valid-token");

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("DESCRIPTION");
  });

  it("別団体のorgSlugではその団体のイベントが返らない", async () => {
    const otherOrg: Organization = { ...testOrg, id: "org-2", slug: "other-choir" };
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(otherOrg);
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

    const app = createPublicApp();
    const res = await app.request("/public/calendar/other-choir/feed.ics?token=valid-token");

    expect(res.status).toBe(404);
    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-2", calendarFeedToken: "valid-token", deletedAt: null },
    });
  });
});
