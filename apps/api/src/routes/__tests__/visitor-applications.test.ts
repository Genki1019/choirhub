import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Member, Organization, VisitorApplication } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    visitorApplication: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    member: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));

vi.mock("../../services/mail.js", () => ({
  sendBulkMail: vi.fn(),
}));

import { prisma } from "../../lib/prisma.js";
import { sendBulkMail } from "../../services/mail.js";
import {
  visitorApplicationsRouter,
  handlePublicVisitorApplication,
} from "../visitor-applications.js";

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
  visitorFormToken: "webhook-token-abc",
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

const makeApplication = (overrides: Partial<VisitorApplication> = {}): VisitorApplication => ({
  id: "app-1",
  orgId: "org-1",
  name: "見学 太郎",
  partHope: "テノール",
  originGroup: "○○大学グリークラブ",
  contact: "visitor@example.com",
  message: null,
  source: "manual",
  status: "pending",
  createdById: "member-1",
  reviewedById: null,
  reviewedAt: null,
  createdAt: new Date("2026-07-01"),
  ...overrides,
});

const adminMemberRow = {
  userRef: { email: "admin@example.com" },
};

function createTestApp(actingMember: Member, org: Organization = testOrg) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", org);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", visitorApplicationsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.member.findMany).mockResolvedValue([adminMemberRow] as never);
});

// ────────────────────────────
// POST /visitor-applications
// ────────────────────────────

describe("POST /visitor-applications", () => {
  it("member: 見学申込を登録でき、adminへ通知メールが送られる", async () => {
    vi.mocked(prisma.visitorApplication.create).mockResolvedValue(makeApplication());

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "見学 太郎", partHope: "テノール" }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.name).toBe("見学 太郎");
    expect(sendBulkMail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendBulkMail).mock.calls[0][0].to).toEqual([{ email: "admin@example.com" }]);
  });

  it("visitor: 403", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "見学 太郎" }),
    });
    expect(res.status).toBe(403);
  });

  it("name未入力: 400", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("admin不在の場合は通知メールを送らない", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([]);
    vi.mocked(prisma.visitorApplication.create).mockResolvedValue(makeApplication());

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "見学 太郎" }),
    });
    expect(res.status).toBe(201);
    expect(sendBulkMail).not.toHaveBeenCalled();
  });
});

// ────────────────────────────
// GET /visitor-applications
// ────────────────────────────

describe("GET /visitor-applications", () => {
  it("admin: 一覧を取得できる", async () => {
    vi.mocked(prisma.visitorApplication.findMany).mockResolvedValue([
      { ...makeApplication(), createdBy: null, reviewedBy: null } as never,
    ]);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications?status=pending");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(1);
  });

  it("admin以外: 403", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications");
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────
// POST /visitor-applications/:id/approve
// ────────────────────────────

describe("POST /visitor-applications/:id/approve", () => {
  it("admin: 承認でき、紹介メール下書きが返る", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(makeApplication());
    vi.mocked(prisma.visitorApplication.update).mockResolvedValue(
      makeApplication({ status: "approved", reviewedById: "admin-1", reviewedAt: new Date() }),
    );

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request("/visitor-applications/app-1/approve", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.application.status).toBe("approved");
    expect(body.data.draft.body).toContain("見学 太郎さん");
    expect(body.data.draft.body).toContain("テノール");
  });

  it("希望パートが未入力: 下書きは「未定」で埋められる", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(
      makeApplication({ partHope: null, originGroup: null }),
    );
    vi.mocked(prisma.visitorApplication.update).mockResolvedValue(
      makeApplication({ status: "approved", partHope: null, originGroup: null }),
    );

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/app-1/approve", { method: "POST" });
    const body = await json(res);
    expect(body.data.draft.body).toContain("希望パート: 未定");
  });

  it("出身団体が未入力: 「出身団体」の区間ごと表示から消える（未定とは表示しない）", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(
      makeApplication({ originGroup: null }),
    );
    vi.mocked(prisma.visitorApplication.update).mockResolvedValue(
      makeApplication({ status: "approved", originGroup: null }),
    );

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/app-1/approve", { method: "POST" });
    const body = await json(res);
    expect(body.data.draft.body).toBe(
      "以下の方が見学にいらっしゃいます。\n\n・見学 太郎さん（希望パート: テノール）",
    );
    expect(body.data.draft.body).not.toContain("出身団体");
  });

  it("団体独自のテンプレートが設定されている場合: そのテンプレートで下書きが生成される", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(makeApplication());
    vi.mocked(prisma.visitorApplication.update).mockResolvedValue(
      makeApplication({ status: "approved" }),
    );

    const app = createTestApp(makeMember(["admin"]), {
      ...testOrg,
      visitorIntroSubjectTemplate: "新入団希望者のお知らせ",
      visitorIntroBodyTemplate: "{lines}\n以上です。",
      visitorIntroLineTemplate: "{name}（{part}）",
    });
    const res = await app.request("/visitor-applications/app-1/approve", { method: "POST" });
    const body = await json(res);
    expect(body.data.draft.subject).toBe("新入団希望者のお知らせ");
    expect(body.data.draft.body).toBe("見学 太郎（テノール）\n以上です。");
  });

  it("見つからない: 404", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(null);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/missing/approve", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("処理済み: 409", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(
      makeApplication({ status: "approved" }),
    );
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/app-1/approve", { method: "POST" });
    expect(res.status).toBe(409);
  });

  it("admin以外: 403", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications/app-1/approve", { method: "POST" });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────
// POST /visitor-applications/:id/reject
// ────────────────────────────

describe("POST /visitor-applications/:id/reject", () => {
  it("admin: 却下できる", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(makeApplication());
    vi.mocked(prisma.visitorApplication.update).mockResolvedValue(
      makeApplication({ status: "rejected" }),
    );

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/app-1/reject", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.status).toBe("rejected");
  });

  it("admin以外: 403", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications/app-1/reject", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("見つからない: 404", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(null);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/missing/reject", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("処理済み: 409", async () => {
    vi.mocked(prisma.visitorApplication.findFirst).mockResolvedValue(
      makeApplication({ status: "rejected" }),
    );
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/app-1/reject", { method: "POST" });
    expect(res.status).toBe(409);
  });
});

// ────────────────────────────
// POST /visitor-applications/bulk-approve
// ────────────────────────────

describe("POST /visitor-applications/bulk-approve", () => {
  it("admin: 複数件を一括承認し、全員分の下書きが返る", async () => {
    vi.mocked(prisma.visitorApplication.findMany).mockResolvedValue([
      makeApplication({ id: "app-1", name: "見学 太郎" }),
      makeApplication({ id: "app-2", name: "見学 花子", partHope: "ソプラノ", originGroup: null }),
    ]);
    vi.mocked(prisma.visitorApplication.updateMany).mockResolvedValue({ count: 2 });

    const app = createTestApp(makeMember(["admin"], "admin-1"));
    const res = await app.request("/visitor-applications/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["app-1", "app-2"] }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.applications).toHaveLength(2);
    // 太郎: 出身団体あり → 表示される / 花子: 出身団体なし → その区間ごと非表示
    expect(body.data.draft.body).toContain(
      "・見学 太郎さん（希望パート: テノール / 出身団体: ○○大学グリークラブ）",
    );
    expect(body.data.draft.body).toContain("・見学 花子さん（希望パート: ソプラノ）");
    expect(body.data.draft.body).not.toMatch(/花子.*出身団体/);
  });

  it("承認可能な申込がない: 404", async () => {
    vi.mocked(prisma.visitorApplication.findMany).mockResolvedValue([]);
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["app-1"] }),
    });
    expect(res.status).toBe(404);
  });

  it("ids未指定: 400", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/visitor-applications/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("admin以外: 403", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/visitor-applications/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["app-1"] }),
    });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────
// POST /public/visitor-applications（Googleフォームwebhook）
// ────────────────────────────

describe("handlePublicVisitorApplication", () => {
  function createPublicApp() {
    const app = new Hono();
    app.post("/public/visitor-applications", handlePublicVisitorApplication);
    return app;
  }

  it("正しいtoken: 201でorgに紐付いた申込が作成される", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(testOrg);
    vi.mocked(prisma.visitorApplication.create).mockResolvedValue(
      makeApplication({ source: "google_form" }),
    );

    const app = createPublicApp();
    const res = await app.request("/public/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "webhook-token-abc", name: "見学 太郎" }),
    });

    expect(res.status).toBe(201);
    expect(prisma.visitorApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", source: "google_form" }),
      }),
    );
  });

  it("不正なtoken: 404", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    const app = createPublicApp();
    const res = await app.request("/public/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "wrong-token", name: "見学 太郎" }),
    });
    expect(res.status).toBe(404);
  });

  it("name未入力: 400", async () => {
    const app = createPublicApp();
    const res = await app.request("/public/visitor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "webhook-token-abc", name: "" }),
    });
    expect(res.status).toBe(400);
  });
});
