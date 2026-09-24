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
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    member: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma.js";
import {
  notificationsRouter,
  handleAttendanceDueCron,
  handleNotificationsCleanupCron,
  notifyEmailChanged,
} from "../notifications.js";

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

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", notificationsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /notifications", () => {
  it("バリデーションエラー: pageが数値でないは400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/notifications?page=abc");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("正常: 自分宛の通知のみ取得し、metaにunreadCountを含む", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: "notif-1",
        type: "mailing_received",
        title: "7月練習のご案内",
        body: null,
        link: "/mailing/mail-1",
        readAt: null,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/notifications");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0]).toEqual({
      id: "notif-1",
      type: "mailing_received",
      title: "7月練習のご案内",
      body: null,
      link: "/mailing/mail-1",
      readAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    expect(body.meta).toEqual({ total: 5, page: 1, perPage: 20, unreadCount: 2 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: testOrg.id, memberId: actingMember.id } }),
    );
  });

  it("バリデーションエラー: statusがall/unread/read以外は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/notifications?status=archived");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("status=unread: readAtがnullの通知のみに絞り込む", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(0);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    await app.request("/notifications?status=unread");

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id, memberId: actingMember.id, readAt: null },
      }),
    );
  });

  it("status=read: readAtが設定済みの通知のみに絞り込む", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(0);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    await app.request("/notifications?status=read");

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id, memberId: actingMember.id, readAt: { not: null } },
      }),
    );
  });
});

describe("PATCH /notifications/:id/read", () => {
  it("他人宛の通知: 404を返す", async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      id: "notif-1",
      orgId: "org-1",
      memberId: "member-2",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/notifications/notif-1/read", { method: "PATCH" });

    expect(res.status).toBe(404);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("正常: 自分宛の通知を既読化する", async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      id: "notif-1",
      orgId: "org-1",
      memberId: "member-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.notification.update).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/notifications/notif-1/read", { method: "PATCH" });

    expect(res.status).toBe(204);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: "notif-1", orgId: testOrg.id },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe("PATCH /notifications/read-all", () => {
  it("正常: 自分の未読を一括既読化する", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/notifications/read-all", { method: "PATCH" });

    expect(res.status).toBe(204);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { orgId: testOrg.id, memberId: actingMember.id, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe("notifyEmailChanged", () => {
  it("複数団体に所属している場合は所属分すべてに通知を作成する", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-1", orgId: "org-1" },
      { id: "member-9", orgId: "org-2" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    await notifyEmailChanged("user-1");

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          orgId: "org-1",
          memberId: "member-1",
          type: "email_changed",
          title: "メールアドレスが変更されました",
          link: "/members/member-1",
        },
        {
          orgId: "org-2",
          memberId: "member-9",
          type: "email_changed",
          title: "メールアドレスが変更されました",
          link: "/members/member-9",
        },
      ],
    });
  });

  it("所属団体がない場合は何もしない", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);

    await notifyEmailChanged("user-1");

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("handleAttendanceDueCron", () => {
  function createCronApp() {
    const app = new Hono();
    app.post("/cron/attendance-due", handleAttendanceDueCron);
    return app;
  }

  it("Authorizationヘッダーが不一致: 401を返す", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const app = createCronApp();
    const res = await app.request("/cron/attendance-due", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("正常: 未回答の対象団員に通知を作成し、既存通知があれば重複作成しない", async () => {
    process.env.CRON_SECRET = "secret-abc";
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      {
        id: "event-1",
        orgId: "org-1",
        title: "定期演奏会 直前合わせ",
        targetRoles: [],
        targetPartIds: [],
        attendances: [{ memberId: "member-2", status: "attending" }],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      makeMember(["member"], "member-1"),
      makeMember(["member"], "member-2"),
      makeMember(["member"], "member-3"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { memberId: "member-3" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createCronApp();
    const res = await app.request("/cron/attendance-due", {
      method: "POST",
      headers: { Authorization: "Bearer secret-abc" },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.createdCount).toBe(1);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ org: { deletedAt: null } }),
      }),
    );
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          orgId: "org-1",
          memberId: "member-1",
          type: "attendance_due",
          title: "「定期演奏会 直前合わせ」の出欠回答期限が近づいています",
          link: "/schedule/event-1",
        },
      ],
    });
  });
});

describe("handleNotificationsCleanupCron", () => {
  function createCronApp() {
    const app = new Hono();
    app.post("/cron/notifications-cleanup", handleNotificationsCleanupCron);
    return app;
  }

  it("Authorizationヘッダーが不一致: 401を返す", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const app = createCronApp();
    const res = await app.request("/cron/notifications-cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it("正常: 既読から90日以上経過した通知のみ削除する", async () => {
    process.env.CRON_SECRET = "secret-abc";
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 12 });

    const app = createCronApp();
    const res = await app.request("/cron/notifications-cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer secret-abc" },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.deletedCount).toBe(12);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { readAt: { not: null, lt: expect.any(Date) } },
    });
  });
});
