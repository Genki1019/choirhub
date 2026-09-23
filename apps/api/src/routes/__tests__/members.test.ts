import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  Prisma,
  type Member,
  type Organization,
  type Part,
  type User,
} from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`email`)",
    {
      code: "P2002",
      clientVersion: "test",
    },
  );
}

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    member: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    inviteToken: {
      create: vi.fn(),
    },
    emailChangeToken: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    part: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../lib/redis.js", () => ({
  checkEmailChangeRateLimit: vi.fn(),
}));

vi.mock("../../services/mail.js", () => ({
  sendInviteEmail: vi.fn(),
  resolveInviteRecipient: vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (existingUser: any, fallbackNameJa?: string | null) => ({
      nameJa: existingUser?.nameJa ?? fallbackNameJa ?? null,
      isExistingUser: existingUser !== null,
    }),
  ),
  sendEmailChangeConfirmationEmail: vi.fn(),
  sendEmailChangedNotification: vi.fn(),
}));

vi.mock("../../services/storage.js", () => ({
  storage: {
    resolveAvatarUrl: vi.fn((key: string | null) =>
      key ? `https://cdn.example.com/${key}` : null,
    ),
    upload: vi.fn(),
    delete: vi.fn(),
  },
}));

import { prisma } from "../../lib/prisma.js";
import { storage } from "../../services/storage.js";
import { checkEmailChangeRateLimit } from "../../lib/redis.js";
import {
  sendInviteEmail,
  sendEmailChangeConfirmationEmail,
  sendEmailChangedNotification,
} from "../../services/mail.js";
import { membersRouter } from "../members.js";

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

const testPart: Part = {
  id: "part-1",
  orgId: "org-1",
  name: "Tenor I",
  voiceType: "tenor",
  sortOrder: 1,
  isCustom: false,
};

const makeAdminMember = (): Member => ({
  id: "member-admin",
  userId: "user-admin",
  orgId: "org-1",
  partId: "part-1",
  memberTypeId: null,
  roles: ["admin"],
  status: "active",
  bio: "管理者です",
  job: "エンジニア",
  interests: "コーヒー",
  originGroup: "大学合唱団",
  joinedAt: new Date("2020-04-01"),
  deletedAt: null,
  phone: "090-1234-5678",
  adminMemo: "メモ",
  calendarFeedToken: null,
  createdAt: new Date("2020-04-01"),
});

const makeNormalMember = (id = "member-1"): Member => ({
  id,
  userId: `user-${id}`,
  orgId: "org-1",
  partId: "part-1",
  memberTypeId: null,
  roles: ["member"],
  status: "active",
  bio: "よろしく",
  job: "会社員",
  interests: "ランニング",
  originGroup: null,
  joinedAt: new Date("2022-04-01"),
  deletedAt: null,
  phone: "080-9999-9999",
  adminMemo: "メモ",
  calendarFeedToken: null,
  createdAt: new Date("2022-04-01"),
});

const testUser: User = {
  id: "user-1",
  email: "test@example.com",
  passwordHash: "hash",
  nameJa: "山田 太郎",
  nameEn: "Taro Yamada",
  nameKana: "ヤマダ タロウ",
  avatarUrl: null,
  createdAt: new Date("2022-04-01"),
};

// ────────────────────────────
// テストアプリ作成ヘルパー
// ────────────────────────────

// 各テスト前にモックをリセットして前のテストの影響を受けないようにする
beforeEach(() => {
  vi.resetAllMocks();
});

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    c.set("user", {
      id: actingMember.userId,
      nameJa: "テストユーザー",
      email: "test@example.com",
      avatarUrl: null,
    });
    return next();
  });
  app.route("/", membersRouter);
  return app;
}

// ────────────────────────────
// GET /members — メンバー一覧
// ────────────────────────────

describe("GET /members", () => {
  const memberWithPart = {
    ...makeNormalMember(),
    userRef: testUser,
    part: testPart,
  };

  beforeEach(() => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([memberWithPart] as unknown as Member[]);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
  });

  it("一覧を返す", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("member-1");
  });

  it("phone と adminMemo は一般ユーザーには含まれない", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members");
    const body = await json(res);
    expect(body.data[0]).not.toHaveProperty("phone");
    expect(body.data[0]).not.toHaveProperty("adminMemo");
  });

  it("phone と adminMemo は admin には含まれる", async () => {
    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members");
    const body = await json(res);
    expect(body.data[0]).toHaveProperty("phone");
    expect(body.data[0]).toHaveProperty("adminMemo");
  });

  it("partId クエリパラメータでフィルタされる", async () => {
    const app = createTestApp(makeNormalMember());
    await app.request("/members?partId=part-1");
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ partId: "part-1" }),
      }),
    );
  });

  it("status クエリパラメータでフィルタされる", async () => {
    const app = createTestApp(makeNormalMember());
    await app.request("/members?status=offstage");
    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "offstage" }),
      }),
    );
  });
});

// ────────────────────────────
// GET /members/me — 自分のプロフィール
// ────────────────────────────

describe("GET /members/me", () => {
  it("自分のプロフィールを返す（phone・adminMemo含む）", async () => {
    const me = makeNormalMember("member-1");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      ...me,
      userRef: testUser,
      part: testPart,
    } as unknown as Member);

    const app = createTestApp(me);
    const res = await app.request("/members/me");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.id).toBe("member-1");
    expect(body.data.phone).toBe("080-9999-9999");
    expect(body.data.adminMemo).toBe("メモ");
  });

  it("対応するMemberレコードが存在しない: 404を返す", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me");

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// ────────────────────────────
// PATCH /members/me — 自分のプロフィール更新
// ────────────────────────────

describe("PATCH /members/me", () => {
  it("bio を更新できる", async () => {
    const me = makeNormalMember();
    const updated = { ...me, bio: "更新された自己紹介", userRef: testUser, part: testPart };
    vi.mocked(prisma.member.update).mockResolvedValue(updated as unknown as Member);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(updated as unknown as Member);

    const app = createTestApp(me);
    const res = await app.request("/members/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "更新された自己紹介" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.bio).toBe("更新された自己紹介");
  });

  it("バリデーションエラー: 不正なフィールドは 400 を返す", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: "not-a-url" }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("nameJa の更新時は User テーブルも更新される", async () => {
    const me = makeNormalMember();
    vi.mocked(prisma.member.update).mockResolvedValue({
      ...me,
      userRef: testUser,
      part: testPart,
    } as unknown as Member);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...testUser, nameJa: "新しい名前" });

    const app = createTestApp(me);
    await app.request("/members/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "新しい名前" }),
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: me.userId },
        data: expect.objectContaining({ nameJa: "新しい名前" }),
      }),
    );
  });
});

// ────────────────────────────
// POST /members/me/email-change — メールアドレス変更申請
// ────────────────────────────

describe("POST /members/me/email-change", () => {
  beforeEach(() => {
    vi.mocked(checkEmailChangeRateLimit).mockResolvedValue(true);
  });

  it("未認証相当（userが見つからない）: 404を返す", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "new@example.com" }),
    });

    expect(res.status).toBe(404);
  });

  it("不正なメール形式: 400 VALIDATION_ERRORを返す", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "not-an-email" }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("現在のメールアドレスと同一: 400を返す", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: testUser.email }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("member 未満のロール（guest/visitor）は 403 を返す", async () => {
    const app = createTestApp({ ...makeNormalMember(), roles: ["visitor"] });
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "new@example.com" }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("レート制限中: 429を返す", async () => {
    vi.mocked(checkEmailChangeRateLimit).mockResolvedValue(false);

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "new@example.com" }),
    });

    expect(res.status).toBe(429);
    const body = await json(res);
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("正常系: 200を返し既存トークンの無効化・新規トークン作成・メール送信が行われる", async () => {
    const me = makeNormalMember();
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(testUser) // currentUser取得
      .mockResolvedValueOnce(null); // newEmailの重複チェック（未使用）
    const newToken = {
      id: "token-id",
      token: "new-token-abc",
      userId: me.userId,
      newEmail: "new@example.com",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      usedAt: null,
      createdAt: new Date(),
    };
    vi.mocked(prisma.emailChangeToken.updateMany).mockResolvedValue({ count: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.emailChangeToken.create).mockResolvedValue(newToken as any);
    // $transaction([updateMany, create]) を配列の結果を返す実装としてモックする
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation((ops: any) => Promise.all(ops));
    vi.mocked(sendEmailChangeConfirmationEmail).mockResolvedValue(undefined);

    const app = createTestApp(me);
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "new@example.com" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.message).toBe("確認メールを送信しました");
    expect(prisma.emailChangeToken.updateMany).toHaveBeenCalledWith({
      where: { userId: me.userId, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.emailChangeToken.create).toHaveBeenCalledWith({
      data: { userId: me.userId, newEmail: "new@example.com", expiresAt: expect.any(Date) },
    });
    expect(sendEmailChangeConfirmationEmail).toHaveBeenCalledWith({
      to: "new@example.com",
      nameJa: testUser.nameJa,
      confirmToken: "new-token-abc",
      expiresAt: expect.any(Date),
    });
  });

  it("既に他ユーザーが使用中のアドレス: 正常系と区別できない同一レスポンスを返す（列挙対策）", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(testUser) // currentUser取得
      .mockResolvedValueOnce({ ...testUser, id: "user-other" }); // newEmailは既に他ユーザーが使用中

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "taken@example.com" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.message).toBe("確認メールを送信しました");
    expect(prisma.emailChangeToken.create).not.toHaveBeenCalled();
    expect(sendEmailChangeConfirmationEmail).not.toHaveBeenCalled();
  });

  it("同時リクエストで部分ユニークインデックスに違反（P2002）した場合も200を返す（列挙対策の一貫性維持）", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(testUser) // currentUser取得
      .mockResolvedValueOnce(null); // newEmailの重複チェック（未使用）
    vi.mocked(prisma.$transaction).mockRejectedValue(uniqueConstraintError());

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: "new@example.com" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.message).toBe("確認メールを送信しました");
    expect(sendEmailChangeConfirmationEmail).not.toHaveBeenCalled();
  });
});

// ────────────────────────────
// GET /members/:id — メンバー詳細
// ────────────────────────────

describe("GET /members/:id", () => {
  it("メンバー詳細を返す", async () => {
    const target = makeNormalMember("member-2");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      ...target,
      userRef: testUser,
      part: testPart,
    } as unknown as Member);

    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/member-2");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.id).toBe("member-2");
  });

  it("存在しないメンバー → 404", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/nonexistent");
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他テナントのメンバー取得は 404（orgId ミスマッチ）", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/other-org-member");
    expect(res.status).toBe(404);
  });

  it("自分自身を閲覧している場合（admin以外）: emailを含む", async () => {
    const me = makeNormalMember("member-1");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      ...me,
      userRef: testUser,
      part: testPart,
    } as unknown as Member);

    const app = createTestApp(me);
    const res = await app.request("/members/member-1");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.email).toBe(testUser.email);
  });

  it("自分以外を閲覧している場合（admin以外）: emailを含まない", async () => {
    const target = makeNormalMember("member-2");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      ...target,
      userRef: testUser,
      part: testPart,
    } as unknown as Member);

    const app = createTestApp(makeNormalMember("member-1"));
    const res = await app.request("/members/member-2");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).not.toHaveProperty("email");
  });
});

// ────────────────────────────
// PATCH /members/:id — admin による更新
// ────────────────────────────

describe("PATCH /members/:id", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation((ops: any) => Promise.all(ops));
  });

  it("admin はロールを変更できる", async () => {
    const target = makeNormalMember("member-2");
    const updated = { ...target, roles: ["member", "tech"], userRef: testUser, part: testPart };
    vi.mocked(prisma.member.findUnique)
      .mockResolvedValueOnce(target as unknown as Member)
      .mockResolvedValueOnce(updated as unknown as Member);
    vi.mocked(prisma.member.update).mockResolvedValue(updated as unknown as Member);

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles: ["member", "tech"] }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.roles).toEqual(["member", "tech"]);
  });

  it("admin 以外は 403", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles: ["admin"] }),
    });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("自分自身への PATCH /members/:id は 400（/me を使うべき）", async () => {
    const admin = makeAdminMember();
    const app = createTestApp(admin);
    const res = await app.request(`/members/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "offstage" }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("SELF_UPDATE_FORBIDDEN");
  });

  it("admin はメンバーのメールアドレスを即時変更できる（セッション失効・通知メール送信を伴う）", async () => {
    const target = makeNormalMember("member-2");
    const updated = {
      ...target,
      userRef: { ...testUser, email: "new@example.com" },
      part: testPart,
    };
    vi.mocked(prisma.member.findUnique)
      .mockResolvedValueOnce(target as unknown as Member)
      .mockResolvedValueOnce(updated as unknown as Member);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...testUser, email: "new@example.com" });
    vi.mocked(prisma.member.update).mockResolvedValue(updated as unknown as Member);
    vi.mocked(sendEmailChangedNotification).mockResolvedValue(undefined);

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: target.userId },
      data: { email: "new@example.com" },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: target.userId } });
    expect(prisma.emailChangeToken.updateMany).toHaveBeenCalledWith({
      where: { userId: target.userId, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(sendEmailChangedNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: testUser.email, newEmail: "new@example.com" }),
    );
    expect(sendEmailChangedNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@example.com", newEmail: "new@example.com" }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        orgId: testOrg.id,
        memberId: target.id,
        type: "email_changed",
        title: "メールアドレスが変更されました",
        link: `/members/${target.id}`,
      },
    });
  });

  it("admin が既に使用中のメールアドレスに変更しようとすると409 CONFLICTを返す", async () => {
    const target = makeNormalMember("member-2");
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(target as unknown as Member);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.user.update).mockRejectedValue(uniqueConstraintError());

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "taken@example.com" }),
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it("email が現在の値と同一なら User の更新・通知は行われない", async () => {
    const target = makeNormalMember("member-2");
    const updated = { ...target, userRef: testUser, part: testPart };
    vi.mocked(prisma.member.findUnique)
      .mockResolvedValueOnce(target as unknown as Member)
      .mockResolvedValueOnce(updated as unknown as Member);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.member.update).mockResolvedValue(updated as unknown as Member);

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email }),
    });

    expect(res.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(sendEmailChangedNotification).not.toHaveBeenCalled();
  });

  it("email変更と同時のmember.update失敗時は、email変更もロールバックされ副作用が起きない", async () => {
    const target = makeNormalMember("member-2");
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(target as unknown as Member);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...testUser, email: "new@example.com" });
    vi.mocked(prisma.member.update).mockRejectedValue(new Error("member update failed"));

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", adminMemo: "メモ更新" }),
    });

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    // member.update失敗時はトランザクション全体が失敗したものとして扱い、
    // セッション失効・トークン無効化・通知メールなどの副作用を一切実行しない
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.emailChangeToken.updateMany).not.toHaveBeenCalled();
    expect(sendEmailChangedNotification).not.toHaveBeenCalled();
  });
});

// ────────────────────────────
// POST /members/invite — 招待
// ────────────────────────────

describe("POST /members/invite", () => {
  it("admin は招待メールを送信できる", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.inviteToken.create).mockResolvedValue({
      id: "token-1",
      token: "test-token-abc",
      email: "new@example.com",
      orgId: "org-1",
      roles: ["member"],
      partId: "part-1",
      expiresAt: new Date("2026-06-11T00:00:00Z"),
      usedAt: null,
      createdAt: new Date(),
    } as never);

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", roles: ["member"] }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toHaveProperty("inviteToken");
    expect(body.data).toHaveProperty("expiresAt");
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ isExistingUser: false }),
    );
  });

  it("招待先が既存ユーザーの場合はisExistingUser: trueでメール送信する", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.inviteToken.create).mockResolvedValue({
      id: "token-1",
      token: "test-token-abc",
      email: testUser.email,
      orgId: "org-1",
      roles: ["member"],
      partId: null,
      expiresAt: new Date("2026-06-11T00:00:00Z"),
      usedAt: null,
      createdAt: new Date(),
    } as never);

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, roles: ["member"] }),
    });

    expect(res.status).toBe(201);
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ isExistingUser: true, nameJa: testUser.nameJa }),
    );
  });

  it("admin 以外は 403", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com" }),
    });
    expect(res.status).toBe(403);
  });

  it("不正な email → 400", async () => {
    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ────────────────────────────
// GET /parts — パート一覧
// ────────────────────────────

describe("GET /parts", () => {
  it("member未満(guest): 403を返す", async () => {
    const app = createTestApp({ ...makeNormalMember(), roles: ["guest"] });
    const res = await app.request("/parts");
    expect(res.status).toBe(403);
  });

  it("member: 200で一覧を取得できる（sortOrder昇順）", async () => {
    vi.mocked(prisma.part.findMany).mockResolvedValue([testPart]);
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/parts");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual([
      { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
    ]);
    expect(prisma.part.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { sortOrder: "asc" },
    });
  });
});

// ────────────────────────────
// POST /members/me/avatar — アバターアップロード
// ────────────────────────────

describe("POST /members/me/avatar", () => {
  it("fileが無い: 400を返す", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/me/avatar", {
      method: "POST",
      body: new FormData(),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("許可されていないMIMEタイプ: 400を返す", async () => {
    const app = createTestApp(makeNormalMember());
    const form = new FormData();
    form.append("file", new File(["dummy"], "avatar.svg", { type: "image/svg+xml" }));
    const res = await app.request("/members/me/avatar", { method: "POST", body: form });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("ファイルサイズが4MB超: 400を返す", async () => {
    const app = createTestApp(makeNormalMember());
    const form = new FormData();
    const oversized = new Uint8Array(4 * 1024 * 1024 + 1);
    form.append("file", new File([oversized], "avatar.png", { type: "image/png" }));
    const res = await app.request("/members/me/avatar", { method: "POST", body: form });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it.each([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
  ])("%s: 200でアップロードしavatarUrlを更新する", async (mimeType) => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ avatarUrl: null } as never);
    vi.mocked(prisma.user.update).mockResolvedValue(testUser);

    const app = createTestApp(makeNormalMember());
    const form = new FormData();
    form.append("file", new File(["dummy"], "avatar", { type: mimeType }));
    const res = await app.request("/members/me/avatar", { method: "POST", body: form });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    expect(storage.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), mimeType);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-member-1" },
      data: { avatarUrl: expect.any(String) },
    });
  });

  it("既存アバターがある場合: 旧ファイルをstorage.deleteで削除する", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      avatarUrl: "avatars/old-key.jpg",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue(testUser);

    const app = createTestApp(makeNormalMember());
    const form = new FormData();
    form.append("file", new File(["dummy"], "avatar.png", { type: "image/png" }));
    await app.request("/members/me/avatar", { method: "POST", body: form });

    expect(storage.delete).toHaveBeenCalledWith("avatars/old-key.jpg");
  });
});

// ────────────────────────────
// DELETE /members/:id — 退団処理（ソフトデリート）
// ────────────────────────────

describe("DELETE /members/:id", () => {
  it("admin未満: 403を返す", async () => {
    const app = createTestApp(makeNormalMember());
    const res = await app.request("/members/member-2", { method: "DELETE" });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("自分自身: 403を返す", async () => {
    const admin = makeAdminMember();
    vi.mocked(prisma.member.findUnique).mockResolvedValue(admin);
    const app = createTestApp(admin);
    const res = await app.request(`/members/${admin.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("存在しないid: 404を返す", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/no-such-member", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("他テナントのid: 404を返す", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      ...makeNormalMember("member-other"),
      orgId: "org-2",
    });
    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-other", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("admin: 200でdeletedAtをセットして{success: true}を返す", async () => {
    const target = makeNormalMember("member-2");
    vi.mocked(prisma.member.findUnique).mockResolvedValue(target);
    vi.mocked(prisma.member.update).mockResolvedValue({
      ...target,
      deletedAt: new Date("2026-07-15"),
    });

    const app = createTestApp(makeAdminMember());
    const res = await app.request("/members/member-2", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ success: true });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: "member-2" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
