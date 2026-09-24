import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Inquiry, User } from "../../generated/prisma/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    session: { findUnique: vi.fn(), update: vi.fn() },
    inquiry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../lib/redis.js", () => ({ checkInquiryRateLimit: vi.fn() }));

vi.mock("../../services/mail.js", () => ({ sendBulkMail: vi.fn() }));

import { prisma } from "../../lib/prisma.js";
import { checkInquiryRateLimit } from "../../lib/redis.js";
import { sendBulkMail } from "../../services/mail.js";
import { inquiriesRouter } from "../inquiries.js";

function createTestApp() {
  const app = new Hono();
  app.route("/", inquiriesRouter);
  return app;
}

const adminUser: User = {
  id: "admin-1",
  email: "sysadmin@example.com",
  passwordHash: "hashed-password",
  nameJa: "システム管理者",
  nameEn: null,
  nameKana: null,
  avatarUrl: null,
  createdAt: new Date("2022-04-01"),
};

const regularUser: User = { ...adminUser, id: "user-1", email: "user@example.com" };

const testInquiry: Inquiry = {
  id: "inq-1",
  category: "org_restore",
  name: "山田 太郎",
  email: "yamada@example.com",
  orgName: "東京男声合唱団",
  message: "誤って団体を削除してしまいました",
  status: "open",
  resolvedByEmail: null,
  resolvedAt: null,
  createdAt: new Date("2026-09-24T00:00:00Z"),
};

function mockSession(user: User) {
  process.env.SYSTEM_ADMIN_EMAILS = adminUser.email;
  vi.mocked(prisma.session.findUnique).mockResolvedValue({
    id: "session-abc",
    userId: user.id,
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    isVisitor: false,
    user,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.SYSTEM_ADMIN_EMAILS = adminUser.email;
});

// ────────────────────────────
// POST /auth/inquiries
// ────────────────────────────

describe("POST /auth/inquiries", () => {
  const validBody = {
    category: "org_restore",
    name: "山田 太郎",
    email: "yamada@example.com",
    orgName: "東京男声合唱団",
    message: "誤って団体を削除してしまいました",
  };

  function postInquiry(body: unknown) {
    return createTestApp().request("/auth/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it.each([
    ["不正な種別", { ...validBody, category: "unknown" }],
    ["氏名が空", { ...validBody, name: "  " }],
    ["不正なメールアドレス", { ...validBody, email: "not-an-email" }],
    ["本文が空", { ...validBody, message: "" }],
    ["本文が2000文字超", { ...validBody, message: "あ".repeat(2001) }],
  ])("%s: 400を返し保存しない", async (_, body) => {
    const res = await postInquiry(body);
    expect(res.status).toBe(400);
    expect(prisma.inquiry.create).not.toHaveBeenCalled();
  });

  it("レート制限超過: 429を返し保存しない", async () => {
    vi.mocked(checkInquiryRateLimit).mockResolvedValue(false);
    const res = await postInquiry(validBody);
    expect(res.status).toBe(429);
    expect(prisma.inquiry.create).not.toHaveBeenCalled();
  });

  it("成功: 保存し、システム管理者へ種別・送信者・本文入りの通知メールを送る", async () => {
    vi.mocked(checkInquiryRateLimit).mockResolvedValue(true);
    const res = await postInquiry(validBody);

    expect(res.status).toBe(201);
    expect(prisma.inquiry.create).toHaveBeenCalledWith({ data: validBody });
    const mail = vi.mocked(sendBulkMail).mock.calls[0][0];
    expect(mail.to).toEqual([{ email: "sysadmin@example.com" }]);
    expect(mail.subject).toBe("【ChoirHub】お問い合わせ（削除した団体の復元）");
    expect(mail.body).toContain("メールアドレス: yamada@example.com");
    expect(mail.body).toContain("団体名: 東京男声合唱団");
    expect(mail.body).toContain("誤って団体を削除してしまいました");
  });

  it("団体名が空文字の場合はnullで保存し、通知メールに団体名行を含めない", async () => {
    vi.mocked(checkInquiryRateLimit).mockResolvedValue(true);
    await postInquiry({ ...validBody, orgName: "" });

    expect(prisma.inquiry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgName: null }),
    });
    expect(vi.mocked(sendBulkMail).mock.calls[0][0].body).not.toContain("団体名:");
  });

  it("通知メールの送信に失敗しても問い合わせは保存済みのため201を返す", async () => {
    vi.mocked(checkInquiryRateLimit).mockResolvedValue(true);
    vi.mocked(sendBulkMail).mockRejectedValue(new Error("resend down"));
    const res = await postInquiry(validBody);
    expect(res.status).toBe(201);
  });

  it("SYSTEM_ADMIN_EMAILS未設定: 保存のみ行いメールは送らない", async () => {
    process.env.SYSTEM_ADMIN_EMAILS = "";
    vi.mocked(checkInquiryRateLimit).mockResolvedValue(true);
    const res = await postInquiry(validBody);
    expect(res.status).toBe(201);
    expect(prisma.inquiry.create).toHaveBeenCalled();
    expect(sendBulkMail).not.toHaveBeenCalled();
  });
});

// ────────────────────────────
// GET /auth/inquiries
// ────────────────────────────

describe("GET /auth/inquiries", () => {
  function getList(query = "") {
    return createTestApp().request(`/auth/inquiries${query}`, {
      headers: { Cookie: "session=session-abc" },
    });
  }

  it("システム管理者以外: 403を返す", async () => {
    mockSession(regularUser);
    const res = await getList();
    expect(res.status).toBe(403);
    expect(prisma.inquiry.findMany).not.toHaveBeenCalled();
  });

  it("status省略時は未対応(open)を新しい順に返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.inquiry.findMany).mockResolvedValue([testInquiry]);

    const res = await getList();
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(prisma.inquiry.findMany).toHaveBeenCalledWith({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
    });
    expect(body.data[0]).toMatchObject({ id: "inq-1", category: "org_restore" });
  });

  it("status=resolved: 対応済みを返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.inquiry.findMany).mockResolvedValue([]);
    await getList("?status=resolved");
    expect(prisma.inquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "resolved" } }),
    );
  });

  it("不正なstatus: 400を返す", async () => {
    mockSession(adminUser);
    const res = await getList("?status=unknown");
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────
// POST /auth/inquiries/:id/resolve
// ────────────────────────────

describe("POST /auth/inquiries/:id/resolve", () => {
  function postResolve(id: string) {
    return createTestApp().request(`/auth/inquiries/${id}/resolve`, {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });
  }

  it("システム管理者以外: 403を返す", async () => {
    mockSession(regularUser);
    const res = await postResolve("inq-1");
    expect(res.status).toBe(403);
    expect(prisma.inquiry.updateMany).not.toHaveBeenCalled();
  });

  it("成功: 未対応のときのみ対応者・対応日時を記録してresolvedにする", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.inquiry.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.inquiry.findUniqueOrThrow).mockResolvedValue({
      ...testInquiry,
      status: "resolved",
    });

    const res = await postResolve("inq-1");
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(prisma.inquiry.updateMany).toHaveBeenCalledWith({
      where: { id: "inq-1", status: "open" },
      data: {
        status: "resolved",
        resolvedByEmail: "sysadmin@example.com",
        resolvedAt: expect.any(Date),
      },
    });
    expect(body.data.status).toBe("resolved");
  });

  it("既に対応済み: 409を返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.inquiry.updateMany).mockResolvedValue({ count: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue({ id: "inq-1" } as any);
    const res = await postResolve("inq-1");
    expect(res.status).toBe(409);
  });

  it("存在しない: 404を返す", async () => {
    mockSession(adminUser);
    vi.mocked(prisma.inquiry.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue(null);
    const res = await postResolve("inq-unknown");
    expect(res.status).toBe(404);
  });
});
