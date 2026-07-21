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
    concert: { findFirst: vi.fn() },
    outreachActivity: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    member: { findMany: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { outreachRouter } from "../outreach.js";

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
};

const makeActivity = (opts: {
  id: string;
  createdById: string;
  participantIds: string[];
  status?: string;
}) => ({
  id: opts.id,
  concertId: "concert-1",
  destination: "渋谷駅前",
  activityDate: new Date("2026-05-10T00:00:00Z"),
  note: null,
  status: opts.status ?? "pending",
  paidAt: null,
  createdById: opts.createdById,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  creator: { id: opts.createdById, userRef: { nameJa: "申請者" } },
  participants: opts.participantIds.map((memberId, i) => ({
    id: `participant-${i}`,
    activityId: opts.id,
    memberId,
    ticketsSold: 0,
    expense: null,
    member: { id: memberId, partId: null, userRef: { nameJa: `参加者${i}` }, part: null },
  })),
});

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", outreachRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /tickets/:concertId/outreach", () => {
  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/tickets/nonexistent/outreach");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（非ticket担当者）: 自分が申請/参加したもののみ返る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.outreachActivity.findMany).mockResolvedValue([
      makeActivity({ id: "activity-mine", createdById: "member-1", participantIds: ["member-1"] }),
      makeActivity({
        id: "activity-others",
        createdById: "member-2",
        participantIds: ["member-2"],
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.map((a: { id: string }) => a.id)).toEqual(["activity-mine"]);
  });

  it("正常（ticket担当者）: 全件返る", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.outreachActivity.findMany).mockResolvedValue([
      makeActivity({ id: "activity-1", createdById: "member-1", participantIds: ["member-1"] }),
      makeActivity({ id: "activity-2", createdById: "member-2", participantIds: ["member-2"] }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["ticket"], "ticket-manager"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`);

    const body = await json(res);
    expect(body.data.map((a: { id: string }) => a.id)).toEqual(["activity-1", "activity-2"]);
  });
});

describe("POST /tickets/:concertId/outreach", () => {
  const validBody = {
    destination: "渋谷駅前",
    activityDate: "2026-05-10",
    participants: [{ memberId: "member-1", ticketsSold: 3 }],
  };

  it("バリデーションエラー: participantsが空配列は400を返す", async () => {
    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, participants: [] }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("guest/visitorが申請: 403を返す", async () => {
    const app = createTestApp(makeMember(["visitor"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("一般団員が自分を参加者に含めない: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        participants: [{ memberId: "member-2", ticketsSold: 3 }],
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/nonexistent/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("参加者に別テナントのメンバーが含まれる: 400 INVALID_MEMBERを返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([{ id: "member-1" }] as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        participants: [
          { memberId: "member-1", ticketsSold: 3 },
          { memberId: "other-org-member", ticketsSold: 1 },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("INVALID_MEMBER");
    expect(prisma.outreachActivity.create).not.toHaveBeenCalled();
  });

  it("正常（ticket担当者は自分を含めなくても申請可）: 201を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.member.findMany).mockResolvedValue([{ id: "member-2" }] as any);
    vi.mocked(prisma.outreachActivity.create).mockResolvedValue(
      makeActivity({
        id: "activity-new",
        createdById: "ticket-manager",
        participantIds: ["member-2"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );

    const app = createTestApp(makeMember(["ticket"], "ticket-manager"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        participants: [{ memberId: "member-2", ticketsSold: 3 }],
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.id).toBe("activity-new");
    expect(prisma.outreachActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ concertId: testConcert.id, createdById: "ticket-manager" }),
      }),
    );
  });
});

describe("PATCH /tickets/:concertId/outreach/:activityId/pay", () => {
  it("ticket担当者/admin以外: 403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request(`/tickets/${testConcert.id}/outreach/activity-1/pay`, {
      method: "PATCH",
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request("/tickets/nonexistent/outreach/activity-1/pay", {
      method: "PATCH",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("情宣活動が存在しない/別演奏会: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.outreachActivity.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/outreach/nonexistent/pay`, {
      method: "PATCH",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: status:paid・paidAtが設定される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    const activity = makeActivity({
      id: "activity-1",
      createdById: "member-2",
      participantIds: ["member-2"],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.outreachActivity.findFirst).mockResolvedValue(activity as any);
    vi.mocked(prisma.outreachActivity.update).mockResolvedValue({
      ...activity,
      status: "paid",
      paidAt: new Date("2026-06-01T00:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["ticket"]));
    const res = await app.request(`/tickets/${testConcert.id}/outreach/activity-1/pay`, {
      method: "PATCH",
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.status).toBe("paid");
    expect(prisma.outreachActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "activity-1" },
        data: { status: "paid", paidAt: expect.any(Date) },
      }),
    );
  });
});

describe("DELETE /tickets/:concertId/outreach/:activityId", () => {
  it("演奏会が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/tickets/nonexistent/outreach/activity-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("情宣活動が存在しない/別演奏会: 404を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.outreachActivity.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach/nonexistent`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("申請者でも担当者でもない: 403を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.outreachActivity.findFirst).mockResolvedValue(
      makeActivity({
        id: "activity-1",
        createdById: "member-2",
        participantIds: ["member-2"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach/activity-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常（申請者本人）: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.concert.findFirst).mockResolvedValue(testConcert as any);
    vi.mocked(prisma.outreachActivity.findFirst).mockResolvedValue(
      makeActivity({
        id: "activity-1",
        createdById: "member-1",
        participantIds: ["member-1"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.outreachActivity.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request(`/tickets/${testConcert.id}/outreach/activity-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(prisma.outreachActivity.delete).toHaveBeenCalledWith({
      where: { id: "activity-1", concertId: testConcert.id },
    });
  });
});
