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
    mailLog: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    mailTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    member: { findMany: vi.fn() },
  },
}));

vi.mock("../../services/mail.js", () => ({
  sendBulkMail: vi.fn(),
  getResendEmail: vi.fn(),
}));

vi.mock("../../services/storage.js", () => ({
  storage: { resolveAvatarUrl: vi.fn((url: string | null) => url) },
}));

import { prisma } from "../../lib/prisma.js";
import { sendBulkMail, getResendEmail } from "../../services/mail.js";
import { mailingRouter } from "../mailing.js";

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

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", mailingRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /mailing", () => {
  it("バリデーションエラー: pageが数値でないは400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing?page=abc");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("正常: 送信者/受信者に該当するメールのみクエリされる", async () => {
    vi.mocked(prisma.mailLog.count).mockResolvedValue(0);
    vi.mocked(prisma.mailLog.findMany).mockResolvedValue([]);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    await app.request("/mailing");

    expect(prisma.mailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: testOrg.id,
          OR: [{ sentById: actingMember.id }, { recipientMemberIds: { has: actingMember.id } }],
        },
      }),
    );
  });

  it("正常: metaにtotal/page/perPageが返る", async () => {
    vi.mocked(prisma.mailLog.count).mockResolvedValue(42);
    vi.mocked(prisma.mailLog.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing?page=2&perPage=10");

    const body = await json(res);
    expect(body.meta).toEqual({ total: 42, page: 2, perPage: 10 });
  });

  it("正常: Cache-Control: no-storeヘッダーが付与される", async () => {
    vi.mocked(prisma.mailLog.count).mockResolvedValue(0);
    vi.mocked(prisma.mailLog.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing");

    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("メールが0件: 空配列を返す", async () => {
    vi.mocked(prisma.mailLog.count).mockResolvedValue(0);
    vi.mocked(prisma.mailLog.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("GET /mailing/templates", () => {
  it("guest/visitor未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/mailing/templates");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: updatedAt降順で返る", async () => {
    vi.mocked(prisma.mailTemplate.findMany).mockResolvedValue([
      {
        id: "template-1",
        name: "練習案内",
        subject: "○月練習のご案内",
        body: "本文",
        createdById: "member-2",
        updatedAt: new Date("2026-06-11T00:00:00Z"),
        creator: { userRef: { nameJa: "山田 太郎" } },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/templates");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0]).toEqual({
      id: "template-1",
      name: "練習案内",
      subject: "○月練習のご案内",
      body: "本文",
      createdBy: { id: "member-2", nameJa: "山田 太郎" },
      updatedAt: "2026-06-11T00:00:00.000Z",
    });
    expect(prisma.mailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: testOrg.id },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("テンプレートが0件: 空配列を返す", async () => {
    vi.mocked(prisma.mailTemplate.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/templates");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([]);
  });
});

describe("POST /mailing/templates", () => {
  const validBody = { name: "練習案内", subject: "○月練習のご案内", body: "本文" };

  it("バリデーションエラー: nameが空は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, name: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("guest/visitor未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/mailing/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: 201を返す", async () => {
    vi.mocked(prisma.mailTemplate.create).mockResolvedValue({
      id: "template-1",
      name: "練習案内",
      subject: "○月練習のご案内",
      body: "本文",
      updatedAt: new Date("2026-06-11T00:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/mailing/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.id).toBe("template-1");
    expect(prisma.mailTemplate.create).toHaveBeenCalledWith({
      data: {
        orgId: testOrg.id,
        createdById: actingMember.id,
        name: "練習案内",
        subject: "○月練習のご案内",
        body: "本文",
      },
    });
  });
});

describe("PATCH /mailing/templates/:id", () => {
  const testTemplate = { id: "template-1", orgId: "org-1", createdById: "member-1" };

  it("バリデーションエラー: nameが空文字は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/templates/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("テンプレートが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/templates/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("作成者でも管理者でもない: 403を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(testTemplate as any);

    const app = createTestApp(makeMember(["member"], "member-2"));
    const res = await app.request("/mailing/templates/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常（作成者本人）: 更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(testTemplate as any);
    vi.mocked(prisma.mailTemplate.update).mockResolvedValue({
      id: "template-1",
      name: "改名",
      subject: "件名",
      body: "本文",
      updatedAt: new Date("2026-06-12T00:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/mailing/templates/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.name).toBe("改名");
  });

  it("正常（admin・作成者でなくても）: 更新される", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(testTemplate as any);
    vi.mocked(prisma.mailTemplate.update).mockResolvedValue({
      id: "template-1",
      name: "改名",
      subject: "件名",
      body: "本文",
      updatedAt: new Date("2026-06-12T00:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request("/mailing/templates/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "改名" }),
    });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /mailing/templates/:id", () => {
  const testTemplate = { id: "template-1", orgId: "org-1", createdById: "member-1" };

  it("テンプレートが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/templates/nonexistent", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("作成者でも管理者でもない: 403を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(testTemplate as any);

    const app = createTestApp(makeMember(["member"], "member-2"));
    const res = await app.request("/mailing/templates/template-1", { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常（作成者本人）: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(testTemplate as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/mailing/templates/template-1", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(prisma.mailTemplate.delete).toHaveBeenCalledWith({
      where: { id: "template-1", orgId: testOrg.id },
    });
  });

  it("正常（admin）: 204を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.findFirst).mockResolvedValue(testTemplate as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailTemplate.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request("/mailing/templates/template-1", { method: "DELETE" });

    expect(res.status).toBe(204);
  });
});

describe("GET /mailing/:id", () => {
  const makeMail = (opts: { sentById: string; recipientMemberIds: string[] }) => ({
    id: "mail-1",
    orgId: "org-1",
    sentById: opts.sentById,
    sentAt: new Date("2026-05-30T03:00:00Z"),
    recipientMemberIds: opts.recipientMemberIds,
    resendIds: ["resend-1"],
    sentBy: { userRef: { nameJa: "幹事 花子" } },
  });

  it("メールが存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.mailLog.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/nonexistent");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("送信者でも受信者でもない（adminも例外なし）: 404を返す", async () => {
    vi.mocked(prisma.mailLog.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeMail({ sentById: "member-2", recipientMemberIds: ["member-3"] }) as any,
    );

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request("/mailing/mail-1");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常（送信者本人）: 200を返す", async () => {
    vi.mocked(prisma.mailLog.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeMail({ sentById: "member-1", recipientMemberIds: [] }) as any,
    );
    vi.mocked(getResendEmail).mockResolvedValue({
      id: "resend-1",
      to: ["a@example.com"],
      from: "noreply@example.com",
      subject: "○月練習のご案内",
      created_at: "2026-05-30T03:00:00.000Z",
      last_event: "delivered",
      html: "<p>本文</p>",
      text: "本文",
    });

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/mailing/mail-1");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.id).toBe("mail-1");
  });

  it("正常（受信者）: recipientsがResend APIの並列取得結果を反映する", async () => {
    vi.mocked(prisma.mailLog.findUnique).mockResolvedValue({
      ...makeMail({ sentById: "member-2", recipientMemberIds: ["member-1"] }),
      resendIds: ["resend-1", "resend-2"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(getResendEmail).mockImplementation(async (id: string) => ({
      id,
      to: [`${id}@example.com`],
      from: "noreply@example.com",
      subject: "○月練習のご案内",
      created_at: "2026-05-30T03:00:00.000Z",
      last_event: "delivered",
      html: "<p>本文</p>",
      text: "本文",
    }));

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/mailing/mail-1");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.recipients).toEqual([
      { email: "resend-1@example.com", lastEvent: "delivered" },
      { email: "resend-2@example.com", lastEvent: "delivered" },
    ]);
  });

  it("正常: resendIdsのいずれかが取得失敗（null）した場合recipientsから除外される", async () => {
    vi.mocked(prisma.mailLog.findUnique).mockResolvedValue({
      ...makeMail({ sentById: "member-1", recipientMemberIds: [] }),
      resendIds: ["resend-1", "resend-missing"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(getResendEmail).mockImplementation(async (id: string) =>
      id === "resend-missing"
        ? null
        : {
            id,
            to: ["a@example.com"],
            from: "noreply@example.com",
            subject: "○月練習のご案内",
            created_at: "2026-05-30T03:00:00.000Z",
            last_event: "delivered",
            html: null,
            text: null,
          },
    );

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/mailing/mail-1");

    const body = await json(res);
    expect(body.data.recipients).toHaveLength(1);
  });
});

describe("POST /mailing/send", () => {
  const validBody = { subject: "7月練習のご案内", body: "本文", recipientType: "all" as const };

  it("バリデーションエラー: subjectが空は400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, subject: "" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("guest/visitor未満: 403を返す", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("recipientType: partでpartIdsが空: 400を返し全員送信にフォールバックしない", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, recipientType: "part", recipientFilter: null }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("recipientType: roleでrolesが空配列: 400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        recipientType: "role",
        recipientFilter: { roles: [] },
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("recipientType: customでmemberIdsが未指定: 400を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, recipientType: "custom" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("正常（recipientType: all）: アクティブ全団員に送信される", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-2", userRef: { email: "b@example.com" } },
      { id: "member-3", userRef: { email: "c@example.com" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(sendBulkMail).mockResolvedValue(["resend-1"]);
    vi.mocked(prisma.mailLog.create).mockResolvedValue({
      id: "mail-1",
      sentAt: new Date("2026-06-04T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["member"], "member-1"));
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.recipientCount).toBe(2);
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: testOrg.id,
          status: "active",
          NOT: { roles: { hasSome: ["guest", "visitor"] } },
        },
      }),
    );
  });

  it("正常（recipientType: part）: partIdsで絞り込みされguest/visitorは除外される", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);
    vi.mocked(sendBulkMail).mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailLog.create).mockResolvedValue({ id: "mail-1", sentAt: new Date() } as any);

    const app = createTestApp(makeMember(["member"]));
    await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        recipientType: "part",
        recipientFilter: { partIds: ["part-1"] },
      }),
    });

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: testOrg.id,
          status: "active",
          partId: { in: ["part-1"] },
          NOT: { roles: { hasSome: ["guest", "visitor"] } },
        },
      }),
    );
  });

  it("正常（recipientType: role）: rolesで絞り込みされguest/visitorは除外されない", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);
    vi.mocked(sendBulkMail).mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.mailLog.create).mockResolvedValue({ id: "mail-1", sentAt: new Date() } as any);

    const app = createTestApp(makeMember(["member"]));
    await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        recipientType: "role",
        recipientFilter: { roles: ["guest"] },
      }),
    });

    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { orgId: testOrg.id, status: "active", roles: { hasSome: ["guest"] } },
      include: { userRef: { select: { email: true } } },
    });
  });

  it("正常（recipientType: custom）: memberIdsで絞り込みMailLogが作成される", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: "member-2", userRef: { email: "b@example.com" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(sendBulkMail).mockResolvedValue(["resend-1"]);
    vi.mocked(prisma.mailLog.create).mockResolvedValue({
      id: "mail-1",
      sentAt: new Date("2026-06-04T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const actingMember = makeMember(["member"], "member-1");
    const app = createTestApp(actingMember);
    const res = await app.request("/mailing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        recipientType: "custom",
        recipientFilter: { memberIds: ["member-2"] },
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { orgId: testOrg.id, status: "active", id: { in: ["member-2"] } },
      include: { userRef: { select: { email: true } } },
    });
    expect(prisma.mailLog.create).toHaveBeenCalledWith({
      data: {
        orgId: testOrg.id,
        sentById: actingMember.id,
        sentAt: expect.any(Date),
        subject: validBody.subject,
        bodyPreview: validBody.body.slice(0, 200),
        resendIds: ["resend-1"],
        recipientMemberIds: ["member-2"],
      },
    });
  });
});
