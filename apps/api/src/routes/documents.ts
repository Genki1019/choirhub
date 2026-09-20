import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { extname } from "path";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isVisitor, hasRole } from "../services/access.js";
import { storage, CONTENT_TYPES } from "../services/storage.js";
import {
  makeStorageKey,
  keyMatchesScope,
  createStoredFileWithExtension,
  deleteStoredFile,
} from "../services/files.js";
import { fileErrorPage } from "../lib/file-error-page.js";
import { matchesFileSignature, FILE_SIGNATURE_CHECK_LENGTH } from "../lib/file-signature.js";
import type { TenantEnv } from "../middleware/tenant.js";
import type { Member, AccessLevel } from "../generated/prisma/index.js";

const DOCUMENT_CATEGORIES = [
  "bylaws",
  "minutes",
  "member_guide",
  "finance_report",
  "other",
] as const;
type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

const ACCESS_LEVELS = ["secret", "restricted", "public"] as const;

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function canManageDocuments(member: Member): boolean {
  return isAdmin(member);
}

// visitor（体験）は一切アクセス不可。secret=admin限定、restricted=member以上、public=guest以上
function canViewDocument(member: Member, accessLevel: AccessLevel): boolean {
  if (isVisitor(member)) return false;
  if (accessLevel === "secret") return isAdmin(member);
  if (accessLevel === "restricted") return hasRole(member, "member");
  return hasRole(member, "guest");
}

function formatDocument(
  orgSlug: string,
  doc: { id: string; title: string; category: DocumentCategory; accessLevel: AccessLevel },
  file: { fileName: string },
) {
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    accessLevel: doc.accessLevel,
    fileName: file.fileName,
    downloadUrl: `/api/v1/${orgSlug}/documents/${doc.id}/download`,
  };
}

export const documentsRouter = new Hono<TenantEnv>()

  // ── GET /documents ── 資料一覧（category絞り込み可、閲覧可能なもののみ）
  .get("/documents", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (isVisitor(actingMember)) {
      return c.json({ error: { code: "NOT_INVITED", message: "閲覧する権限がありません" } }, 403);
    }

    const { category } = c.req.query();
    if (category !== undefined && !DOCUMENT_CATEGORIES.includes(category as DocumentCategory)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "カテゴリが不正です" } }, 400);
    }

    const docs = await prisma.orgDocument.findMany({
      where: {
        file: { orgId: org.id },
        ...(category ? { category: category as DocumentCategory } : {}),
      },
      include: { file: true },
      orderBy: { file: { uploadedAt: "desc" } },
    });

    const visible = docs.filter((d) => canViewDocument(actingMember, d.accessLevel));
    return c.json({ data: visible.map((d) => formatDocument(org.slug, d, d.file)) });
  })

  // ── POST /documents/presign ── R2プレサインドPUT URL発行（admin限定）
  .post(
    "/documents/presign",
    zValidator(
      "json",
      z.object({
        category: z.enum(DOCUMENT_CATEGORIES),
        fileName: z.string().min(1),
        contentType: z.string().min(1),
      }),
      (r, c) => {
        if (!r.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!canManageDocuments(actingMember)) {
        return c.json(
          { error: { code: "FORBIDDEN", message: "資料の管理には管理者権限が必要です" } },
          403,
        );
      }

      const { category, fileName } = c.req.valid("json");
      const ext = extname(fileName).toLowerCase();
      if (ext !== ".pdf") {
        return c.json(
          {
            error: { code: "VALIDATION_ERROR", message: "資料はPDF形式でアップロードしてください" },
          },
          400,
        );
      }

      // クライアント指定のcontentTypeは信用せず、拡張子から一意に決まる値を署名する
      // scopeIdにorgIdを含める（categoryだけでは全団体共通の値でテナント固有性がないため）
      const key = makeStorageKey("org_document", `${org.id}/${category}`, ext);
      const signedContentType = CONTENT_TYPES[ext] ?? "application/pdf";
      const presignedUrl = await storage.getPresignedPutUrl(key, signedContentType);

      return c.json({ data: { presignedUrl, key, contentType: signedContentType } });
    },
  )

  // ── POST /documents/confirm ── R2アップロード後のDB登録（admin限定）
  .post(
    "/documents/confirm",
    zValidator(
      "json",
      z.object({
        key: z.string().regex(/^documents\/[^/]+\/[^/]+\/[0-9a-f-]+\.[a-z0-9]+$/i),
        title: z.string().min(1).max(100),
        category: z.enum(DOCUMENT_CATEGORIES),
        accessLevel: z.enum(ACCESS_LEVELS).optional(),
        fileName: z.string().min(1),
      }),
      (r, c) => {
        if (!r.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!canManageDocuments(actingMember)) {
        return c.json(
          { error: { code: "FORBIDDEN", message: "資料の管理には管理者権限が必要です" } },
          403,
        );
      }

      const { key, title, category, accessLevel, fileName } = c.req.valid("json");
      if (!keyMatchesScope("org_document", `${org.id}/${category}`, key)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }

      const ext = extname(key).toLowerCase();
      if (ext !== ".pdf") {
        return c.json(
          {
            error: { code: "VALIDATION_ERROR", message: "資料はPDF形式でアップロードしてください" },
          },
          400,
        );
      }

      const header = await storage.getFileHeader(key, FILE_SIGNATURE_CHECK_LENGTH);
      if (!header) {
        return c.json(
          {
            error: {
              code: "UPLOAD_VERIFICATION_FAILED",
              message: "アップロード内容を確認できませんでした。もう一度お試しください",
            },
          },
          400,
        );
      }
      if (!matchesFileSignature(ext, header)) {
        return c.json(
          { error: { code: "VALIDATION_ERROR", message: "ファイルの内容が拡張子と一致しません" } },
          400,
        );
      }

      const { storedFile, created } = await createStoredFileWithExtension(
        {
          orgId: org.id,
          kind: "org_document",
          storageKey: key,
          fileName,
          uploadedBy: actingMember.id,
        },
        (tx, sf) =>
          tx.orgDocument.create({
            data: { fileId: sf.id, title, category, accessLevel: accessLevel ?? "restricted" },
          }),
      );

      return c.json({ data: formatDocument(org.slug, created, storedFile) }, 201);
    },
  )

  // ── POST /documents ── ファイルアップロード（ローカル開発用・R2未設定時のフォールバック）
  .post("/documents", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!canManageDocuments(actingMember)) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "資料の管理には管理者権限が必要です" } },
        403,
      );
    }

    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || typeof file === "string") {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "ファイルを選択してください" } },
        400,
      );
    }
    const titleResult = z.string().min(1).max(100).safeParse(body["title"]);
    if (!titleResult.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "タイトルを入力してください" } },
        400,
      );
    }
    const categoryResult = z.enum(DOCUMENT_CATEGORIES).safeParse(body["category"]);
    if (!categoryResult.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "カテゴリが不正です" } }, 400);
    }
    const accessLevelResult = z.enum(ACCESS_LEVELS).optional().safeParse(body["accessLevel"]);
    if (!accessLevelResult.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "アクセスレベルが不正です" } },
        400,
      );
    }

    const ext = extname(file.name).toLowerCase();
    if (ext !== ".pdf") {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "資料はPDF形式でアップロードしてください" } },
        400,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: {
            code: "FILE_TOO_LARGE",
            message: "ファイルサイズが上限を超えています（最大20MB）",
          },
        },
        400,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(ext, buffer)) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "ファイルの内容が拡張子と一致しません" } },
        400,
      );
    }

    const key = makeStorageKey("org_document", `${org.id}/${categoryResult.data}`, ext);
    await storage.upload(key, buffer, CONTENT_TYPES[ext] ?? "application/pdf");

    const { storedFile, created } = await createStoredFileWithExtension(
      {
        orgId: org.id,
        kind: "org_document",
        storageKey: key,
        fileName: file.name,
        uploadedBy: actingMember.id,
      },
      (tx, sf) =>
        tx.orgDocument.create({
          data: {
            fileId: sf.id,
            title: titleResult.data,
            category: categoryResult.data,
            accessLevel: accessLevelResult.data ?? "restricted",
          },
        }),
    );

    return c.json({ data: formatDocument(org.slug, created, storedFile) }, 201);
  })

  // ── DELETE /documents/:id ── 資料削除（admin限定）
  .delete("/documents/:id", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    if (!canManageDocuments(actingMember)) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "資料の管理には管理者権限が必要です" } },
        403,
      );
    }

    const doc = await prisma.orgDocument.findUnique({ where: { id }, include: { file: true } });
    if (!doc || doc.file.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "資料が見つかりません" } }, 404);
    }

    await deleteStoredFile({ id: doc.fileId, storageKey: doc.file.storageKey });

    return new Response(null, { status: 204 });
  })

  // ── GET /documents/:id/download ── 資料ダウンロード（accessLevelに応じて制限）
  .get("/documents/:id/download", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    const doc = await prisma.orgDocument.findUnique({ where: { id }, include: { file: true } });
    if (!doc || doc.file.orgId !== org.id) {
      return fileErrorPage(404, "資料が見つかりません");
    }

    if (!canViewDocument(actingMember, doc.accessLevel)) {
      return fileErrorPage(403, "閲覧する権限がありません");
    }

    const download = await storage
      .getFileDownload(doc.file.storageKey, doc.file.fileName)
      .catch(() => null);
    if (!download) {
      return fileErrorPage(404, "ファイルが見つかりません");
    }

    if (download.type === "redirect") {
      return c.redirect(download.url, 302);
    }

    return new Response(download.data, {
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": download.disposition,
        "Content-Length": String(download.data.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
