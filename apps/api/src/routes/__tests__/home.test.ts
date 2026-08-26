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
    event: { findMany: vi.fn() },
    mailLog: { findMany: vi.fn() },
    concert: { findFirst: vi.fn() },
    organizerPeriod: { findFirst: vi.fn() },
  },
}));

vi.mock("../../services/storage.js", () => ({
  storage: { resolveAvatarUrl: vi.fn((url: string | null) => url) },
}));

import { prisma } from "../../lib/prisma.js";
import { homeRouter } from "../home.js";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: "event-1",
    orgId: "org-1",
    title: "第12回定期練習",
    categoryId: "cat-rehearsal",
    startsAt: new Date("2026-08-10T09:30:00Z"),
    endsAt: new Date("2026-08-10T12:00:00Z"),
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
    createdAt: new Date("2024-01-01"),
    category: {
      id: "cat-rehearsal",
      orgId: "org-1",
      name: "練習",
      slug: "rehearsal",
      color: "#3B82F6",
      sortOrder: 0,
      createdAt: new Date("2024-01-01"),
    },
    attendances: [],
    ...overrides,
  };
}

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", homeRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.concert.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.mailLog.findMany).mockResolvedValue([]);
  vi.mocked(prisma.event.findMany).mockResolvedValue([]);
  vi.mocked(prisma.organizerPeriod.findFirst).mockResolvedValue(null);
});

// ────────────────────────────
// GET /home
// ────────────────────────────

describe("GET /home", () => {
  it("権限チェック無し: guestロールでも200で取得できる", async () => {
    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request("/home");
    expect(res.status).toBe(200);
  });

  it("権限チェック無し: visitorロールでも200で取得できる", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/home");
    expect(res.status).toBe(200);
  });

  it("admin: targetRoles・targetPartIdsに関わらず全イベントが見える", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1", targetRoles: ["tech"], targetPartIds: ["part-x"] }),
    ]);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(1);
  });

  it("非admin: targetRolesが自分のロールに含まれない場合は除外される", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1", targetRoles: ["tech"] }),
    ]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(0);
  });

  it("非admin: targetRolesが自分のロールに含まれる場合は表示される", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1", targetRoles: ["tech"] }),
    ]);
    const app = createTestApp(makeMember(["tech"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(1);
  });

  it("非admin: targetPartIdsが自分の所属パートと一致しない場合は除外される", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1", targetPartIds: ["part-x"] }),
    ]);
    const app = createTestApp(makeMember(["member"], "member-1", "part-y"));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(0);
  });

  it("非admin: targetPartIdsが自分の所属パートと一致する場合は表示される", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1", targetPartIds: ["part-x"] }),
    ]);
    const app = createTestApp(makeMember(["member"], "member-1", "part-x"));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(1);
  });

  it("非admin: targetRoles・targetPartIdsが共に空なら全員対象", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([makeEvent({ id: "event-1" })]);
    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(1);
  });

  it("unansweredEventCount: 表示対象イベントのうちundecidedのみカウントする", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1", attendances: [{ status: "undecided" }] }),
      makeEvent({ id: "event-2", attendances: [{ status: "attending" }] }),
      makeEvent({ id: "event-3", attendances: [] }),
    ]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.unansweredEventCount).toBe(2);
  });

  it("upcomingEvents: 表示対象イベントの先頭3件のみ返す", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({ id: "event-1" }),
      makeEvent({ id: "event-2" }),
      makeEvent({ id: "event-3" }),
      makeEvent({ id: "event-4" }),
    ]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.upcomingEvents).toHaveLength(3);
  });

  it("nextRehearsal: category.slugがrehearsalの直近イベントを返す", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([makeEvent({ id: "event-1" })]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.nextRehearsal.id).toBe("event-1");
  });

  it("nextRehearsal: category.nameが練習の直近イベントを返す(slugがnullの場合)", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({
        id: "event-1",
        category: {
          id: "cat-custom",
          orgId: "org-1",
          name: "練習",
          slug: null,
          color: "#3B82F6",
          sortOrder: 0,
          createdAt: new Date("2024-01-01"),
        },
      }),
    ]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.nextRehearsal.id).toBe("event-1");
  });

  it("nextRehearsal: 該当イベントが無ければnull", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.nextRehearsal).toBeNull();
  });

  it("nextConcert: category.slugがconcertの直近イベントを返す", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      makeEvent({
        id: "event-2",
        concertId: "concert-1",
        category: {
          id: "cat-concert",
          orgId: "org-1",
          name: "本番",
          slug: "concert",
          color: "#EF4444",
          sortOrder: 1,
          createdAt: new Date("2024-01-01"),
        },
      }),
    ]);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.nextConcert.id).toBe("event-2");
    expect(body.data.nextConcert.concertId).toBe("concert-1");
  });

  it("nextConcert: 該当イベントが無くConcertレコードがある場合はフォールバックを合成する", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.concert.findFirst).mockResolvedValue({
      id: "concert-1",
      orgId: "org-1",
      title: "第20回定期演奏会",
      heldOn: new Date("2026-09-01T05:00:00Z"),
      venue: "○○ホール",
      status: "confirmed",
      racePublishedAt: null,
      ticketInputClosedAt: null,
      outreachExpensePerTrip: null,
      appliedSurveyId: null,
      scoringConfig: null,
      createdAt: new Date("2024-01-01"),
    });
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.nextConcert).toEqual({
      id: "concert-1",
      title: "第20回定期演奏会",
      category: { id: "", name: "本番", slug: "concert", color: "#EF4444" },
      startsAt: new Date("2026-09-01T05:00:00Z").toISOString(),
      location: "○○ホール",
      concertId: "concert-1",
      myAttendance: "undecided",
    });
  });

  it("nextConcert: 該当イベントもConcertレコードも無ければnull", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(null);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.nextConcert).toBeNull();
  });

  it("recentMails: visitorロールの場合は空配列を返しmailLog.findManyを呼ばない", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.recentMails).toEqual([]);
    expect(prisma.mailLog.findMany).not.toHaveBeenCalled();
  });

  it("recentMails: visitor以外は直近3件をsenderName・senderAvatarUrl付きで返す", async () => {
    vi.mocked(prisma.mailLog.findMany).mockResolvedValue([
      {
        id: "mail-1",
        subject: "6月練習のご案内",
        sentAt: new Date("2026-05-30T12:00:00Z"),
        sentBy: { userRef: { nameJa: "山田太郎", avatarUrl: "avatar.png" } },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.recentMails).toEqual([
      {
        id: "mail-1",
        subject: "6月練習のご案内",
        sentAt: new Date("2026-05-30T12:00:00Z").toISOString(),
        senderName: "山田太郎",
        senderAvatarUrl: "avatar.png",
      },
    ]);
  });

  it("canViewTickets・isTicketManager: ticket管理者でない場合はfalse", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.canViewTickets).toBe(false);
    expect(body.data.isTicketManager).toBe(false);
  });

  it("canViewTickets・isTicketManager: ticketロールの場合はtrue", async () => {
    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.canViewTickets).toBe(true);
    expect(body.data.isTicketManager).toBe(true);
  });

  it("monthlyOrganizer: 当月を含むOrganizerPeriodがあればそのパート名を返す", async () => {
    vi.mocked(prisma.organizerPeriod.findFirst).mockResolvedValue({
      id: "op-1",
      orgId: "org-1",
      partId: "part-1",
      fromMonth: "2026-04",
      toMonth: "2026-06",
      updatedAt: new Date("2026-04-01"),
      part: { id: "part-1", name: "Tenor I" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.monthlyOrganizer).toBe("Tenor I");
    expect(prisma.organizerPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: "org-1" }) }),
    );
  });

  it("monthlyOrganizer: 複数パートの期間が重複した場合に備え、Part.sortOrder昇順でクエリする", async () => {
    // 同時に複数パートが該当するケースはDB側の並び替えに依存するためモックでは再現できない。
    // ここではクエリに正しい orderBy が渡されていることのみ検証する（実際の並び替えは手動でDB検証済み）。
    vi.mocked(prisma.organizerPeriod.findFirst).mockResolvedValue({
      part: { id: "part-1", name: "ソプラノ" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const app = createTestApp(makeMember(["member"]));
    await app.request("/home");

    expect(prisma.organizerPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { part: { sortOrder: "asc" } } }),
    );
  });

  it("monthlyOrganizer: 該当するOrganizerPeriodが無ければnull", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/home");
    const body = await json(res);
    expect(body.data.monthlyOrganizer).toBeNull();
  });
});
