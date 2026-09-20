import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Member, Organization } from "../../generated/prisma/index.js";
import type { TenantEnv } from "../../middleware/tenant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/prisma.js", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    orgDocument: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    storedFile: { create: vi.fn(), delete: vi.fn() },
  };
  prisma.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  return { prisma };
});

vi.mock("../../services/storage.js", () => ({
  storage: {
    getPresignedPutUrl: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    getFileHeader: vi.fn(),
    getFileDownload: vi.fn(),
  },
  CONTENT_TYPES: { ".pdf": "application/pdf" },
}));

import { prisma } from "../../lib/prisma.js";
import { storage } from "../../services/storage.js";
import { documentsRouter } from "../documents.js";

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

const makeStoredFile = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "stored-file-1",
  orgId: "org-1",
  kind: "org_document",
  storageKey: "documents/org-1/bylaws/file-1.pdf",
  fileName: "団則.pdf",
  uploadedBy: "member-1",
  uploadedAt: new Date("2024-01-01"),
  ...overrides,
});

const makeOrgDocument = (
  overrides: Partial<{
    id: string;
    title: string;
    category: string;
    accessLevel: string;
    file: ReturnType<typeof makeStoredFile>;
  }> = {},
) => {
  const { file, ...rest } = overrides;
  return {
    id: "doc-1",
    fileId: "stored-file-1",
    title: "団則",
    category: "bylaws",
    accessLevel: "restricted",
    file: file ?? makeStoredFile(),
    ...rest,
  };
};

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);

function createTestApp(actingMember: Member) {
  const app = new Hono<TenantEnv>();
  app.use("*", (c, next) => {
    c.set("org", testOrg);
    c.set("member", actingMember);
    return next();
  });
  app.route("/", documentsRouter);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────
// GET /documents
// ────────────────────────────

describe("GET /documents", () => {
  it("visitorは403を返す", async () => {
    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request("/documents");

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_INVITED");
  });

  it("不正なcategoryは400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents?category=invalid");

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin: secret/restricted/public全て閲覧可", async () => {
    vi.mocked(prisma.orgDocument.findMany).mockResolvedValue([
      makeOrgDocument({ id: "doc-secret", accessLevel: "secret" }),
      makeOrgDocument({ id: "doc-restricted", accessLevel: "restricted" }),
      makeOrgDocument({ id: "doc-public", accessLevel: "public" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(3);
  });

  it("一般団員（member）: secretは見えずrestricted/publicのみ見える", async () => {
    vi.mocked(prisma.orgDocument.findMany).mockResolvedValue([
      makeOrgDocument({ id: "doc-secret", accessLevel: "secret" }),
      makeOrgDocument({ id: "doc-restricted", accessLevel: "restricted" }),
      makeOrgDocument({ id: "doc-public", accessLevel: "public" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/documents");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.map((d: { id: string }) => d.id).sort()).toEqual([
      "doc-public",
      "doc-restricted",
    ]);
  });

  it("客演（guest）: publicのみ見える", async () => {
    vi.mocked(prisma.orgDocument.findMany).mockResolvedValue([
      makeOrgDocument({ id: "doc-restricted", accessLevel: "restricted" }),
      makeOrgDocument({ id: "doc-public", accessLevel: "public" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request("/documents");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("doc-public");
  });

  it("categoryクエリがwhere句に反映される", async () => {
    vi.mocked(prisma.orgDocument.findMany).mockResolvedValue([]);

    const app = createTestApp(makeMember(["admin"]));
    await app.request("/documents?category=minutes");

    expect(prisma.orgDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { file: { orgId: testOrg.id }, category: "minutes" },
      }),
    );
  });
});

// ────────────────────────────
// POST /documents/presign
// ────────────────────────────

describe("POST /documents/presign", () => {
  it("admin以外は403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/documents/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "bylaws",
        fileName: "a.pdf",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("PDF以外の拡張子は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "bylaws",
        fileName: "a.docx",
        contentType: "application/pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("正常: presignedUrl・keyを返す", async () => {
    vi.mocked(storage.getPresignedPutUrl).mockResolvedValue("https://r2.example.com/presigned");

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "bylaws", fileName: "a.pdf", contentType: "image/png" }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.presignedUrl).toBe("https://r2.example.com/presigned");
    expect(body.data.key).toMatch(/^documents\/org-1\/bylaws\/.+\.pdf$/);
    expect(body.data.contentType).toBe("application/pdf");
    expect(storage.getPresignedPutUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^documents\/org-1\/bylaws\/.+\.pdf$/),
      "application/pdf",
    );
  });
});

// ────────────────────────────
// POST /documents/confirm
// ────────────────────────────

describe("POST /documents/confirm", () => {
  it("バリデーションエラー: keyの形式が不正は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "invalid-key",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("admin以外は403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/bylaws/abc.pdf",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("別カテゴリ宛てに発行されたkey: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/minutes/abc.pdf",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("別団体宛てに発行されたkey: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/other-org-id/bylaws/abc.pdf",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: 対象外拡張子は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/bylaws/abc.docx",
        title: "団則",
        category: "bylaws",
        fileName: "a.docx",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("アップロード内容を取得できない: 400 UPLOAD_VERIFICATION_FAILEDを返す", async () => {
    vi.mocked(storage.getFileHeader).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/bylaws/abc.pdf",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("UPLOAD_VERIFICATION_FAILED");
  });

  it("内容が拡張子と一致しない（拡張子偽装）: 400を返す", async () => {
    vi.mocked(storage.getFileHeader).mockResolvedValue(Buffer.from("not-a-pdf"));

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/bylaws/abc.pdf",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("正常: 201を返しOrgDocumentが作成される（accessLevel省略時はrestricted）", async () => {
    vi.mocked(storage.getFileHeader).mockResolvedValue(PDF_MAGIC_BYTES);
    vi.mocked(prisma.storedFile.create).mockResolvedValue({
      id: "stored-file-1",
      fileName: "a.pdf",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.orgDocument.create).mockResolvedValue({
      id: "doc-1",
      title: "団則",
      category: "bylaws",
      accessLevel: "restricted",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"], "member-1"));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/bylaws/abc.pdf",
        title: "団則",
        category: "bylaws",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data).toEqual({
      id: "doc-1",
      title: "団則",
      category: "bylaws",
      accessLevel: "restricted",
      fileName: "a.pdf",
      downloadUrl: `/api/v1/${testOrg.slug}/documents/doc-1/download`,
    });
    expect(prisma.storedFile.create).toHaveBeenCalledWith({
      data: {
        orgId: testOrg.id,
        kind: "org_document",
        storageKey: "documents/org-1/bylaws/abc.pdf",
        fileName: "a.pdf",
        uploadedBy: "member-1",
      },
    });
    expect(prisma.orgDocument.create).toHaveBeenCalledWith({
      data: {
        fileId: "stored-file-1",
        title: "団則",
        category: "bylaws",
        accessLevel: "restricted",
      },
    });
  });

  it("正常: accessLevel指定時はその値が使われる", async () => {
    vi.mocked(storage.getFileHeader).mockResolvedValue(PDF_MAGIC_BYTES);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.storedFile.create).mockResolvedValue({ id: "stored-file-1" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.create).mockResolvedValue({ id: "doc-1" } as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "documents/org-1/finance_report/abc.pdf",
        title: "会計報告",
        category: "finance_report",
        accessLevel: "secret",
        fileName: "a.pdf",
      }),
    });

    expect(res.status).toBe(201);
    expect(prisma.orgDocument.create).toHaveBeenCalledWith({
      data: {
        fileId: "stored-file-1",
        title: "会計報告",
        category: "finance_report",
        accessLevel: "secret",
      },
    });
  });
});

// ────────────────────────────
// POST /documents（フォールバックアップロード）
// ────────────────────────────

describe("POST /documents（フォールバックアップロード）", () => {
  it("admin以外は403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const fd = new FormData();
    fd.append("file", new File([PDF_MAGIC_BYTES], "a.pdf", { type: "application/pdf" }));
    fd.append("title", "団則");
    fd.append("category", "bylaws");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("ファイル未選択: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const fd = new FormData();
    fd.append("title", "団則");
    fd.append("category", "bylaws");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("タイトル未入力: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const fd = new FormData();
    fd.append("file", new File([PDF_MAGIC_BYTES], "a.pdf", { type: "application/pdf" }));
    fd.append("category", "bylaws");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("カテゴリ不正: 400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const fd = new FormData();
    fd.append("file", new File([PDF_MAGIC_BYTES], "a.pdf", { type: "application/pdf" }));
    fd.append("title", "団則");
    fd.append("category", "invalid");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("拡張子不一致: 対象外拡張子は400を返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const fd = new FormData();
    fd.append("file", new File(["dummy"], "a.docx", { type: "application/octet-stream" }));
    fd.append("title", "団則");
    fd.append("category", "bylaws");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ファイルサイズ超過: 400 FILE_TOO_LARGEを返す", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const bigContent = new Uint8Array(21 * 1024 * 1024);
    const fd = new FormData();
    fd.append("file", new File([bigContent], "big.pdf", { type: "application/pdf" }));
    fd.append("title", "団則");
    fd.append("category", "bylaws");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("内容が拡張子と一致しない（拡張子偽装）: 400を返しアップロードしない", async () => {
    const app = createTestApp(makeMember(["admin"]));
    const fd = new FormData();
    fd.append("file", new File(["not-a-pdf"], "a.pdf", { type: "application/pdf" }));
    fd.append("title", "団則");
    fd.append("category", "bylaws");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("正常: アップロードしOrgDocumentを作成する", async () => {
    vi.mocked(storage.upload).mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.storedFile.create).mockResolvedValue({ id: "stored-file-1" } as any);
    vi.mocked(prisma.orgDocument.create).mockResolvedValue({
      id: "doc-1",
      title: "団則",
      category: "bylaws",
      accessLevel: "public",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const app = createTestApp(makeMember(["admin"]));
    const fd = new FormData();
    fd.append("file", new File([PDF_MAGIC_BYTES], "a.pdf", { type: "application/pdf" }));
    fd.append("title", "団則");
    fd.append("category", "bylaws");
    fd.append("accessLevel", "public");
    const res = await app.request("/documents", { method: "POST", body: fd });

    expect(res.status).toBe(201);
    expect(storage.upload).toHaveBeenCalled();
    const body = await json(res);
    expect(body.data.title).toBe("団則");
    expect(prisma.orgDocument.create).toHaveBeenCalledWith({
      data: { fileId: "stored-file-1", title: "団則", category: "bylaws", accessLevel: "public" },
    });
  });
});

// ────────────────────────────
// DELETE /documents/:id
// ────────────────────────────

describe("DELETE /documents/:id", () => {
  it("admin以外は403を返す", async () => {
    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/documents/doc-1", { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("資料が存在しない/別テナント: 404を返す", async () => {
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request("/documents/nonexistent", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("正常: 204を返しストレージとDBから削除する", async () => {
    const doc = makeOrgDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);
    vi.mocked(storage.delete).mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.storedFile.delete).mockResolvedValue({} as any);

    const app = createTestApp(makeMember(["admin"]));
    const res = await app.request(`/documents/${doc.id}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(storage.delete).toHaveBeenCalledWith(doc.file.storageKey);
    expect(prisma.storedFile.delete).toHaveBeenCalledWith({ where: { id: doc.fileId } });
  });
});

// ────────────────────────────
// GET /documents/:id/download
// ────────────────────────────

describe("GET /documents/:id/download", () => {
  it("資料が存在しない: 404のHTMLを返す", async () => {
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(null);

    const app = createTestApp(makeMember(["member"]));
    const res = await app.request("/documents/doc-1/download");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("visitorはpublicでも403のHTMLを返す", async () => {
    const doc = makeOrgDocument({ accessLevel: "public" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);

    const app = createTestApp(makeMember(["visitor"]));
    const res = await app.request(`/documents/${doc.id}/download`);

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("secret: 一般団員（member）は403、adminは閲覧可", async () => {
    const doc = makeOrgDocument({ accessLevel: "secret" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);

    const memberApp = createTestApp(makeMember(["member"]));
    const memberRes = await memberApp.request(`/documents/${doc.id}/download`);
    expect(memberRes.status).toBe(403);

    vi.mocked(storage.getFileDownload).mockResolvedValue({
      type: "redirect",
      url: "https://r2.example.com/signed",
    });
    const adminApp = createTestApp(makeMember(["admin"]));
    const adminRes = await adminApp.request(`/documents/${doc.id}/download`, {
      redirect: "manual",
    });
    expect(adminRes.status).toBe(302);
  });

  it("restricted: guestは403、memberは閲覧可", async () => {
    const doc = makeOrgDocument({ accessLevel: "restricted" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);

    const guestApp = createTestApp(makeMember(["guest"]));
    const guestRes = await guestApp.request(`/documents/${doc.id}/download`);
    expect(guestRes.status).toBe(403);

    vi.mocked(storage.getFileDownload).mockResolvedValue({
      type: "redirect",
      url: "https://r2.example.com/signed",
    });
    const memberApp = createTestApp(makeMember(["member"]));
    const memberRes = await memberApp.request(`/documents/${doc.id}/download`, {
      redirect: "manual",
    });
    expect(memberRes.status).toBe(302);
  });

  it("public: guestでも閲覧可", async () => {
    const doc = makeOrgDocument({ accessLevel: "public" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);
    vi.mocked(storage.getFileDownload).mockResolvedValue({
      type: "redirect",
      url: "https://r2.example.com/signed",
    });

    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request(`/documents/${doc.id}/download`, { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://r2.example.com/signed");
  });

  it("ストレージ上にファイルが存在しない: 404のHTMLを返す", async () => {
    const doc = makeOrgDocument({ accessLevel: "public" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);
    vi.mocked(storage.getFileDownload).mockRejectedValue(new Error("not found"));

    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request(`/documents/${doc.id}/download`);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("正常: バイナリを200で返しヘッダーが正しく設定される", async () => {
    const doc = makeOrgDocument({ accessLevel: "public" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.orgDocument.findUnique).mockResolvedValue(doc as any);
    vi.mocked(storage.getFileDownload).mockResolvedValue({
      type: "buffer",
      data: Buffer.from("dummy"),
      contentType: "application/pdf",
      disposition: "attachment; filename*=UTF-8''%E5%9B%A3%E5%89%87.pdf",
    });

    const app = createTestApp(makeMember(["guest"]));
    const res = await app.request(`/documents/${doc.id}/download`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      "attachment; filename*=UTF-8''%E5%9B%A3%E5%89%87.pdf",
    );
  });
});
