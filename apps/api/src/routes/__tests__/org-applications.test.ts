import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { Prisma, type User } from "../../generated/prisma/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`slug`)",
    {
      code: "P2002",
      clientVersion: "test",
    },
  );
}

vi.mock("../../lib/prisma.js", () => {
  const tables = {
    session: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    orgApplication: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organization: { create: vi.fn() },
    eventCategory: { createMany: vi.fn() },
    part: { createMany: vi.fn() },
    inviteToken: { create: vi.fn() },
  };
  // $transaction の実装は resetAllMocks で消えるため beforeEach 側で都度設定する（下記参照）
  return { prisma: { ...tables, $transaction: vi.fn() } };
});

vi.mock("../../lib/redis.js", () => ({
  checkOrgApplicationRateLimit: vi.fn(),
}));

vi.mock("../../services/mail.js", () => ({
  sendOrgApplicationEmail: vi.fn(),
  sendInviteEmail: vi.fn(),
  resolveInviteRecipient: vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (existingUser: any, fallbackNameJa?: string | null) => ({
      nameJa: existingUser?.nameJa ?? fallbackNameJa ?? null,
      isExistingUser: existingUser !== null,
    }),
  ),
}));

import { prisma } from "../../lib/prisma.js";
import { checkOrgApplicationRateLimit } from "../../lib/redis.js";
import { sendOrgApplicationEmail, sendInviteEmail } from "../../services/mail.js";
import { orgApplicationsRouter } from "../org-applications.js";

function createTestApp() {
  const app = new Hono();
  app.route("/", orgApplicationsRouter);
  return app;
}

const adminUser: User = {
  id: "admin-1",
  email: "admin@example.com",
  passwordHash: "hashed-password",
  nameJa: "システム管理者",
  nameEn: null,
  nameKana: null,
  avatarUrl: null,
  createdAt: new Date("2022-04-01"),
};

const regularUser: User = {
  id: "user-1",
  email: "user@example.com",
  passwordHash: "hashed-password",
  nameJa: "山田 太郎",
  nameEn: null,
  nameKana: null,
  avatarUrl: null,
  createdAt: new Date("2022-04-01"),
};

const testApplication = {
  id: "app-1",
  orgName: "○○混声合唱団",
  slug: "circle-choir",
  templateKey: "mixed4",
  applicantName: "鈴木 花子",
  applicantEmail: "hanako@example.com",
  message: "40名程度の学生団体です",
  status: "pending" as const,
  reviewedByEmail: null as string | null,
  reviewedAt: null as Date | null,
  createdAt: new Date("2026-08-01"),
};

function mockSessionAsAdmin() {
  process.env.SYSTEM_ADMIN_EMAILS = adminUser.email;
  vi.mocked(prisma.session.findUnique).mockResolvedValue({
    id: "session-abc",
    userId: adminUser.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    user: adminUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function mockSessionAsRegularUser() {
  vi.mocked(prisma.session.findUnique).mockResolvedValue({
    id: "session-abc",
    userId: regularUser.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    user: regularUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

// createOrgWithInvite（Organization/EventCategory/Part/InviteToken作成）が
// 正常系で通るために必要な一連のprismaモックをまとめて設定する
function mockOrgCreationSuccess(slug: string = testApplication.slug) {
  vi.mocked(prisma.organization.create).mockResolvedValue({
    id: "org-new",
    name: testApplication.orgName,
    slug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.eventCategory.createMany).mockResolvedValue({ count: 4 } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.part.createMany).mockResolvedValue({ count: 4 } as any);
  vi.mocked(prisma.inviteToken.create).mockResolvedValue({
    id: "invite-1",
    token: "invite-token-xyz",
    email: testApplication.applicantEmail,
    nameJa: testApplication.applicantName,
    orgId: "org-new",
    roles: ["admin"],
    partId: null,
    usedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  });
}

const originalSystemAdminEmails = process.env.SYSTEM_ADMIN_EMAILS;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(checkOrgApplicationRateLimit).mockResolvedValue(true);
  process.env.SYSTEM_ADMIN_EMAILS = originalSystemAdminEmails;
  // 既存ユーザーとの重複がない前提をデフォルトにし、必要なテストだけ個別に上書きする
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  // $transaction のコールバックには同じprismaモックを渡す
  // （tx.xxx === prisma.xxx としてテストのアサーションがそのまま使える）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.$transaction).mockImplementation((callback: any) => callback(prisma));
});

describe("POST /auth/org-applications", () => {
  it("バリデーションエラー: orgName空は400を返す", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: "",
        slug: testApplication.slug,
        templateKey: "mixed4",
        applicantName: "鈴木 花子",
        applicantEmail: "hanako@example.com",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("バリデーションエラー: slug形式不正時にカスタムメッセージを返す", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: testApplication.orgName,
        slug: "Invalid Slug!",
        templateKey: "mixed4",
        applicantName: testApplication.applicantName,
        applicantEmail: testApplication.applicantEmail,
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("英小文字・数字・ハイフンのみ使用できます");
  });

  it("レート制限超過: 429を返す", async () => {
    vi.mocked(checkOrgApplicationRateLimit).mockResolvedValue(false);

    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: testApplication.orgName,
        slug: testApplication.slug,
        templateKey: "mixed4",
        applicantName: testApplication.applicantName,
        applicantEmail: testApplication.applicantEmail,
      }),
    });

    expect(res.status).toBe(429);
    const body = await json(res);
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("正常: 認証不要で201を返しOrgApplicationを作成、システム管理者へ通知メールを送信する", async () => {
    process.env.SYSTEM_ADMIN_EMAILS = "admin@example.com";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.create).mockResolvedValue(testApplication as any);

    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: testApplication.orgName,
        slug: testApplication.slug,
        templateKey: "mixed4",
        applicantName: testApplication.applicantName,
        applicantEmail: testApplication.applicantEmail,
        message: testApplication.message,
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({ message: "送信しました" });

    expect(prisma.orgApplication.create).toHaveBeenCalledWith({
      data: {
        orgName: testApplication.orgName,
        slug: testApplication.slug,
        templateKey: "mixed4",
        applicantName: testApplication.applicantName,
        applicantEmail: testApplication.applicantEmail,
        message: testApplication.message,
      },
    });
    expect(sendOrgApplicationEmail).toHaveBeenCalledWith({
      to: ["admin@example.com"],
      applicantName: testApplication.applicantName,
      applicantEmail: testApplication.applicantEmail,
      orgName: testApplication.orgName,
      message: testApplication.message,
    });
  });

  it("SYSTEM_ADMIN_EMAILS未設定: 201を返すが通知メールは送信しない", async () => {
    process.env.SYSTEM_ADMIN_EMAILS = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.create).mockResolvedValue(testApplication as any);

    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: testApplication.orgName,
        slug: testApplication.slug,
        templateKey: "mixed4",
        applicantName: testApplication.applicantName,
        applicantEmail: testApplication.applicantEmail,
      }),
    });

    expect(res.status).toBe(201);
    expect(sendOrgApplicationEmail).not.toHaveBeenCalled();
  });
});

describe("GET /auth/org-applications", () => {
  it("Cookieなし: 401を返す", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/org-applications");

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("システム管理者以外: 403を返す", async () => {
    mockSessionAsRegularUser();

    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("正常: pending一覧を返す", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findMany).mockResolvedValue([testApplication] as any);

    const app = createTestApp();
    const res = await app.request("/auth/org-applications", {
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].orgName).toBe(testApplication.orgName);
    expect(prisma.orgApplication.findMany).toHaveBeenCalledWith({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("POST /auth/org-applications/:id/approve", () => {
  function approveRequest(id: string, headers: Record<string, string>, slug?: string) {
    const app = createTestApp();
    return app.request(`/auth/org-applications/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(slug !== undefined ? { slug } : {}),
    });
  }

  it("システム管理者以外: 403を返す", async () => {
    mockSessionAsRegularUser();

    const res = await approveRequest(testApplication.id, { Cookie: "session=session-abc" });

    expect(res.status).toBe(403);
  });

  it("バリデーションエラー: slug形式不正時は400を返す", async () => {
    mockSessionAsAdmin();

    const res = await approveRequest(
      testApplication.id,
      { Cookie: "session=session-abc" },
      "Invalid Slug!",
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("存在しない申請: 404を返す", async () => {
    mockSessionAsAdmin();
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(null);

    const res = await approveRequest("unknown", { Cookie: "session=session-abc" });

    expect(res.status).toBe(404);
  });

  it("処理済みの申請: 409を返す", async () => {
    mockSessionAsAdmin();
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue({
      ...testApplication,
      status: "approved",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await approveRequest(testApplication.id, { Cookie: "session=session-abc" });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("同時に処理された（updateMany が競合で0件更新）: 409を返す", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await approveRequest(testApplication.id, { Cookie: "session=session-abc" });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.message).toBe("既に処理済みの申請です");
    // 競合を検知した時点で団体作成には進まない
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it("スラグが既存団体と重複: 409を返しpendingに戻す", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.organization.create).mockRejectedValue(uniqueConstraintError());

    const res = await approveRequest(testApplication.id, { Cookie: "session=session-abc" });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.message).toBe("このスラグはすでに使用されています");
    // 排他確保のため一旦approvedへ更新した申請を、団体作成失敗を受けてpendingへ戻す
    expect(prisma.orgApplication.update).toHaveBeenCalledWith({
      where: { id: testApplication.id },
      data: { status: "pending", reviewedByEmail: null, reviewedAt: null },
    });
  });

  it("正常: 申請時のスラグで団体・パート・招待トークンを作成し招待メールを送信、申請をapprovedに更新する", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    mockOrgCreationSuccess();

    const res = await approveRequest(testApplication.id, { Cookie: "session=session-abc" });

    expect(res.status).toBe(200);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: testApplication.orgName,
          slug: testApplication.slug,
          partTemplate: { templateKey: "mixed4" },
        }),
      }),
    );
    expect(prisma.eventCategory.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ orgId: "org-new" })]),
    });
    // 混声四部 = 4パート
    expect(prisma.part.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: "ソプラノ", voiceType: "soprano" }),
        expect.objectContaining({ name: "アルト", voiceType: "alto" }),
        expect.objectContaining({ name: "テナー", voiceType: "tenor" }),
        expect.objectContaining({ name: "バス", voiceType: "bass" }),
      ]),
    });
    expect(prisma.inviteToken.create).toHaveBeenCalledWith({
      data: {
        email: testApplication.applicantEmail,
        nameJa: testApplication.applicantName,
        orgId: "org-new",
        roles: ["admin"],
        expiresAt: expect.any(Date),
      },
    });
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: testApplication.applicantEmail,
        nameJa: testApplication.applicantName,
        inviteToken: "invite-token-xyz",
        isExistingUser: false,
      }),
    );
    expect(prisma.orgApplication.updateMany).toHaveBeenCalledWith({
      where: { id: testApplication.id, status: "pending" },
      data: {
        status: "approved",
        reviewedByEmail: adminUser.email,
        reviewedAt: expect.any(Date),
      },
    });
  });

  it("申請者が既存ユーザーの場合はisExistingUser: trueで招待メールを送信する（表示名も既存ユーザーの値を使う）", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    mockOrgCreationSuccess();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      nameJa: "既存 花子",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await approveRequest(testApplication.id, { Cookie: "session=session-abc" });

    expect(res.status).toBe(200);
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: testApplication.applicantEmail,
        nameJa: "既存 花子",
        isExistingUser: true,
      }),
    );
  });

  it("スラグを指定した場合はその値で団体が作成される（システム管理者による上書き）", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    mockOrgCreationSuccess("overridden-slug");

    const res = await approveRequest(
      testApplication.id,
      { Cookie: "session=session-abc" },
      "overridden-slug",
    );

    expect(res.status).toBe(200);
    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "overridden-slug" }),
      }),
    );
  });
});

describe("POST /auth/org-applications/:id/reject", () => {
  it("システム管理者以外: 403を返す", async () => {
    mockSessionAsRegularUser();

    const app = createTestApp();
    const res = await app.request(`/auth/org-applications/${testApplication.id}/reject`, {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(403);
  });

  it("処理済みの申請: 409を返す", async () => {
    mockSessionAsAdmin();
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue({
      ...testApplication,
      status: "rejected",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/org-applications/${testApplication.id}/reject`, {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(409);
  });

  it("同時に処理された（updateMany が競合で0件更新）: 409を返す", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 0 } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/org-applications/${testApplication.id}/reject`, {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.message).toBe("既に処理済みの申請です");
  });

  it("正常: 申請をrejectedに更新する", async () => {
    mockSessionAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.findUnique).mockResolvedValue(testApplication as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgApplication.updateMany).mockResolvedValue({ count: 1 } as any);

    const app = createTestApp();
    const res = await app.request(`/auth/org-applications/${testApplication.id}/reject`, {
      method: "POST",
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(200);
    expect(prisma.orgApplication.updateMany).toHaveBeenCalledWith({
      where: { id: testApplication.id, status: "pending" },
      data: {
        status: "rejected",
        reviewedByEmail: adminUser.email,
        reviewedAt: expect.any(Date),
      },
    });
  });
});

describe("POST /auth/orgs", () => {
  function directCreateRequest(headers: Record<string, string>, body?: Record<string, unknown>) {
    const app = createTestApp();
    return app.request("/auth/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(
        body ?? {
          orgName: testApplication.orgName,
          slug: testApplication.slug,
          templateKey: "mixed4",
          applicantName: testApplication.applicantName,
          applicantEmail: testApplication.applicantEmail,
        },
      ),
    });
  }

  it("システム管理者以外: 403を返す", async () => {
    mockSessionAsRegularUser();

    const res = await directCreateRequest({ Cookie: "session=session-abc" });

    expect(res.status).toBe(403);
  });

  it("Cookieなし: 401を返す", async () => {
    const res = await directCreateRequest({});

    expect(res.status).toBe(401);
  });

  it("バリデーションエラー: orgName空は400を返す", async () => {
    mockSessionAsAdmin();

    const res = await directCreateRequest(
      { Cookie: "session=session-abc" },
      {
        orgName: "",
        slug: testApplication.slug,
        templateKey: "mixed4",
        applicantName: testApplication.applicantName,
        applicantEmail: testApplication.applicantEmail,
      },
    );

    expect(res.status).toBe(400);
  });

  it("スラグが既存団体と重複: 409を返す", async () => {
    mockSessionAsAdmin();
    vi.mocked(prisma.organization.create).mockRejectedValue(uniqueConstraintError());

    const res = await directCreateRequest({ Cookie: "session=session-abc" });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.message).toBe("このスラグはすでに使用されています");
    // OrgApplicationは一切作成されない
    expect(prisma.orgApplication.create).not.toHaveBeenCalled();
  });

  it("正常: 申請レコードを作らずに団体・パート・招待トークンを作成し招待メールを送信する", async () => {
    mockSessionAsAdmin();
    mockOrgCreationSuccess();

    const res = await directCreateRequest({ Cookie: "session=session-abc" });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({ message: "団体を作成し、招待メールを送信しました" });

    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: testApplication.orgName,
          slug: testApplication.slug,
          partTemplate: { templateKey: "mixed4" },
        }),
      }),
    );
    expect(prisma.eventCategory.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ orgId: "org-new" })]),
    });
    expect(prisma.part.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ orgId: "org-new" })]),
    });
    expect(prisma.inviteToken.create).toHaveBeenCalledWith({
      data: {
        email: testApplication.applicantEmail,
        nameJa: testApplication.applicantName,
        orgId: "org-new",
        roles: ["admin"],
        expiresAt: expect.any(Date),
      },
    });
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: testApplication.applicantEmail,
        nameJa: testApplication.applicantName,
        inviteToken: "invite-token-xyz",
        isExistingUser: false,
      }),
    );
    expect(prisma.orgApplication.create).not.toHaveBeenCalled();
  });
});

// orgApplicationsRouter は app.ts で他のルーター（例: /:orgSlug 配下のテナントルーター）と
// 同じ Hono インスタンスに合成される。この構成下でも requireSystemAdmin が無関係なルートに
// 漏れないことを確認する（過去に `.use("*", ...)` を sub-app に付けた際、`.route()` での合成を
// 経て全ルートに適用されてしまい、団体admin がメンバー一覧すら見られなくなる回帰が発生した）。
describe("ルーター合成時にシステム管理者チェックが他ルートへ漏れないこと", () => {
  it("orgApplicationsRouterと同じアプリに合成した無関係なルートは、システム管理者以外でもアクセスできる", async () => {
    mockSessionAsRegularUser();

    const app = new Hono();
    app.route("/", orgApplicationsRouter);
    app.get("/:orgSlug/members", (c) => c.json({ data: [] }));

    const res = await app.request("/harmonia/members", {
      headers: { Cookie: "session=session-abc" },
    });

    expect(res.status).toBe(200);
  });
});
