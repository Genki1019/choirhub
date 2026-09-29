import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuditLog, Member, Organization } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    auditLog: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma.js";
import { auditLogsRouter, handleAuditLogsCleanupCron } from "../audit-logs.js";

const testOrg = { id: "org-1", name: "東京男声合唱団", slug: "tokyo-men-choir" } as Organization;

const makeMember = (roles: string[], id = "member-1"): Member =>
  ({ id, userId: `user-${id}`, orgId: "org-1", roles }) as Member;

const makeLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: "log-1",
  orgId: "org-1",
  actorType: "member",
  actorMemberId: "member-1",
  actorName: "山田 太郎",
  action: "member.roles_changed",
  targetType: "member",
  targetId: "member-2",
  targetLabel: "佐藤 花子",
  changes: { roles: { before: ["member"], after: ["member", "finance"] } },
  ipAddress: "203.0.113.1",
  userAgent: "test-agent",
  createdAt: new Date("2026-09-01T01:00:00Z"),
  ...overrides,
});

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    c.set("user", {
      id: actingMember.userId,
      nameJa: "山田 太郎",
      email: "a@example.com",
      avatarUrl: null,
    });
    return next();
  });
  app.route("/", auditLogsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /settings/audit-logs", () => {
  it.each([["finance"], ["member"], ["tech"]])("%s: 403を返す", async (role) => {
    const res = await createTestApp(makeMember([role])).request("/settings/audit-logs");
    expect(res.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("admin: 自団体の操作履歴を新しい順に1ページ50件で返す", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([makeLog()]);

    const res = await createTestApp(makeMember(["admin"])).request("/settings/audit-logs?page=2");
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { createdAt: "desc" },
      skip: 50,
      take: 50,
    });
    expect(body.meta).toEqual({ total: 1, page: 2, perPage: 50 });
    expect(body.data[0]).toEqual({
      id: "log-1",
      createdAt: "2026-09-01T01:00:00.000Z",
      actorType: "member",
      actorMemberId: "member-1",
      actorName: "山田 太郎",
      action: "member.roles_changed",
      category: "access",
      targetType: "member",
      targetId: "member-2",
      targetLabel: "佐藤 花子",
      changes: { roles: { before: ["member"], after: ["member", "finance"] } },
      ipAddress: "203.0.113.1",
      userAgent: "test-agent",
    });
  });

  it("期間はJSTの日付で、分類はその分類のactionで、操作者はmemberIdで絞り込む", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

    await createTestApp(makeMember(["admin"])).request(
      "/settings/audit-logs?from=2026-09-01&to=2026-09-30&category=org&actorId=cmember0000000000000009",
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: "org-1",
          actorMemberId: "cmember0000000000000009",
          action: {
            in: ["org.renamed", "org.deleted", "org.restored", "org.visitor_webhook_regenerated"],
          },
          createdAt: {
            gte: new Date("2026-08-31T15:00:00Z"),
            lt: new Date("2026-09-30T15:00:00Z"),
          },
        },
      }),
    );
  });

  it("操作者の種別（システム管理者）で絞り込む", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

    await createTestApp(makeMember(["admin"])).request(
      "/settings/audit-logs?actorType=system_admin",
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1", actorType: "system_admin" } }),
    );
  });

  it.each([
    ["category=unknown"],
    ["from=2026/09/01"],
    ["page=0"],
    ["actorId=not-a-cuid"],
    ["actorType=system"],
    ["actorType=member"],
  ])("不正なクエリ（%s）: 400を返す", async (query) => {
    const res = await createTestApp(makeMember(["admin"])).request(`/settings/audit-logs?${query}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /settings/audit-logs/actors", () => {
  it("admin以外: 403を返す", async () => {
    const res = await createTestApp(makeMember(["finance"])).request("/settings/audit-logs/actors");
    expect(res.status).toBe(403);
  });

  it("admin: 団員は氏名変更があっても1件にまとめ最新の氏名で名前順に返し、システム管理者は末尾に1件で返す", async () => {
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([
      {
        actorType: "member",
        actorMemberId: "member-2",
        actorName: "山田 太郎",
        _max: { createdAt: new Date("2026-09-01") },
      },
      {
        actorType: "member",
        actorMemberId: "member-1",
        actorName: "旧姓 花子",
        _max: { createdAt: new Date("2026-01-01") },
      },
      {
        actorType: "member",
        actorMemberId: "member-1",
        actorName: "佐藤 花子",
        _max: { createdAt: new Date("2026-06-01") },
      },
      {
        actorType: "system_admin",
        actorMemberId: null,
        actorName: "運営 太郎（システム管理者）",
        _max: { createdAt: new Date("2026-07-01") },
      },
    ] as never);

    const res = await createTestApp(makeMember(["admin"])).request("/settings/audit-logs/actors");
    const body = await json(res);

    expect(prisma.auditLog.groupBy).toHaveBeenCalledWith({
      by: ["actorType", "actorMemberId", "actorName"],
      where: { orgId: "org-1" },
      _max: { createdAt: true },
    });
    expect(body.data).toEqual([
      { type: "member", memberId: "member-1", name: "佐藤 花子" },
      { type: "member", memberId: "member-2", name: "山田 太郎" },
      { type: "system_admin", name: "システム管理者" },
    ]);
  });

  it("システム管理者の記録がなければ選択肢に含めない", async () => {
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([
      {
        actorType: "member",
        actorMemberId: "member-1",
        actorName: "佐藤 花子",
        _max: { createdAt: new Date("2026-06-01") },
      },
    ] as never);

    const res = await createTestApp(makeMember(["admin"])).request("/settings/audit-logs/actors");

    expect((await json(res)).data).toEqual([
      { type: "member", memberId: "member-1", name: "佐藤 花子" },
    ]);
  });
});

describe("GET /settings/audit-logs/export", () => {
  it("admin以外: 403を返しCSV出力も記録しない", async () => {
    const res = await createTestApp(makeMember(["finance"])).request("/settings/audit-logs/export");
    expect(res.status).toBe(403);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("admin: 日本語ラベル・JST日時でCSVを返し、出力自体を操作履歴に記録する", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([makeLog()]);

    const res = await createTestApp(makeMember(["admin"])).request(
      "/settings/audit-logs/export?category=access",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("audit_logs_");
    const lines = (await res.text()).replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("日時,操作者,操作,対象,変更内容,IPアドレス,User-Agent");
    expect(lines[1]).toBe(
      '2026-09-01 10:00,山田 太郎,ロール変更,佐藤 花子,"{""roles"":{""before"":[""member""],""after"":[""member"",""finance""]}}",203.0.113.1,test-agent',
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "audit_logs.exported",
        targetLabel: "操作履歴（1件）",
      }),
    });
  });
});

describe("handleAuditLogsCleanupCron", () => {
  function createCronApp() {
    const app = new Hono();
    app.get("/cron/audit-logs-cleanup", handleAuditLogsCleanupCron);
    return app;
  }

  it("Authorizationヘッダーが不一致: 401を返す", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const res = await createCronApp().request("/cron/audit-logs-cleanup", {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("正常: 2年より前の操作履歴を削除する", async () => {
    process.env.CRON_SECRET = "secret-abc";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
    vi.mocked(prisma.auditLog.deleteMany).mockResolvedValue({ count: 3 });

    const res = await createCronApp().request("/cron/audit-logs-cleanup", {
      headers: { Authorization: "Bearer secret-abc" },
    });
    vi.useRealTimers();

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ data: { deletedCount: 3 } });
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2024-09-29T00:00:00Z") } },
    });
  });
});
