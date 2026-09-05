import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";
import { extname } from "path";
import { hasRole } from "../services/access.js";
import { storage, CONTENT_TYPES } from "../services/storage.js";
import { fileErrorPage } from "./file-error-page.js";
import { matchesFileSignature, FILE_SIGNATURE_CHECK_LENGTH } from "./file-signature.js";
import type { TenantEnv } from "../middleware/tenant.js";
import type { Member } from "../generated/prisma/index.js";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isAllowedExt(ext: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

function notFoundError(c: Context, message: string) {
  return c.json({ error: { code: "NOT_FOUND", message } }, 404);
}

function forbiddenError(c: Context) {
  return c.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "ファイルの管理には管理者または技術系の権限が必要です",
      },
    },
    403,
  );
}

function notInvitedError(c: Context) {
  return c.json({ error: { code: "NOT_INVITED", message: "閲覧する権限がありません" } }, 403);
}

function extensionError(c: Context) {
  return c.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "ファイルは .pdf / .jpg / .jpeg / .png 形式でアップロードしてください",
      },
    },
    400,
  );
}

function contentMismatchError(c: Context) {
  return c.json(
    { error: { code: "VALIDATION_ERROR", message: "ファイルの内容が拡張子と一致しません" } },
    400,
  );
}

function uploadVerificationError(c: Context) {
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

interface AttachmentFile {
  id: string;
  label: string;
  fileName: string;
}

export interface AttachmentRoutesConfig {
  /** リソースのパス部分。例: "concerts/:concertId" / "events/:id" */
  resourcePath: string;
  /** リソースIDのパラメータ名。例: "concertId" / "id" */
  idParam: string;
  /** R2オブジェクトキー・ダウンロードURLの接頭辞。例: "concerts" / "events" */
  keyPrefix: string;
  /** リソースが存在しない場合のエラーメッセージ */
  notFoundMessage: string;
  /** リソースがorgに属し実在するか確認する */
  resourceExists: (id: string, orgId: string) => Promise<boolean>;
  /**
   * 一覧取得・ダウンロードの存在確認と閲覧権限判定（指定時はこちらが resourceExists の代わりに使われ、
   * 二重フェッチを避ける）。省略時は resourceExists の結果のみで許可する。
   * 招待制イベントなど、閲覧にも絞り込みが必要なリソースで指定する。
   */
  canView?: (
    member: Member,
    resourceId: string,
    orgId: string,
  ) => Promise<"ok" | "not_found" | "forbidden">;
  listFiles: (resourceId: string) => Promise<AttachmentFile[]>;
  createFile: (
    resourceId: string,
    data: { label: string; storageKey: string; fileName: string; uploadedBy: string },
  ) => Promise<AttachmentFile>;
  findFile: (
    fileId: string,
  ) => Promise<(AttachmentFile & { resourceId: string; storageKey: string }) | null>;
  deleteFile: (fileId: string, resourceId: string) => Promise<void>;
}

/**
 * Concert/Event等、リソースに紐づく添付ファイルのCRUD 6エンドポイント（presign/confirm/フォールバックアップロード/一覧/削除/ダウンロード）を生成する。
 * `scores.ts` のファイル管理パターン（fileType・version・partIdなし版）を汎用化したもの。
 */
export function createAttachmentRoutes(config: AttachmentRoutesConfig) {
  const {
    resourcePath,
    idParam,
    keyPrefix,
    notFoundMessage,
    resourceExists,
    canView,
    listFiles,
    createFile,
    findFile,
    deleteFile,
  } = config;

  const getResourceId = (c: Context) => c.req.param(idParam) as string;
  const makeKey = (ext: string) => `${keyPrefix}/${randomUUID()}${ext}`;

  async function checkReadAccess(
    member: Member,
    resourceId: string,
    orgId: string,
  ): Promise<"ok" | "not_found" | "forbidden"> {
    if (canView) return canView(member, resourceId, orgId);
    return (await resourceExists(resourceId, orgId)) ? "ok" : "not_found";
  }

  function formatFile(orgSlug: string, resourceId: string, f: AttachmentFile) {
    return {
      id: f.id,
      label: f.label,
      fileName: f.fileName,
      downloadUrl: `/api/v1/${orgSlug}/${keyPrefix}/${resourceId}/files/${f.id}/download`,
    };
  }

  return (
    new Hono<TenantEnv>()

      // ── POST {resourcePath}/files/presign ── R2プレサインドPUT URL発行
      .post(
        `/${resourcePath}/files/presign`,
        zValidator(
          "json",
          z.object({
            label: z.string().min(1).max(50),
            fileName: z.string().min(1),
            contentType: z.string().min(1),
          }),
          (r, c) => {
            if (!r.success)
              return c.json(
                { error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } },
                400,
              );
          },
        ),
        async (c) => {
          const actingMember = c.get("member");
          const org = c.get("org");
          const resourceId = getResourceId(c);

          if (!(await resourceExists(resourceId, org.id))) {
            return notFoundError(c, notFoundMessage);
          }
          if (!hasRole(actingMember, "tech")) {
            return forbiddenError(c);
          }

          const { fileName } = c.req.valid("json");
          const ext = extname(fileName).toLowerCase();
          if (!isAllowedExt(ext)) {
            return extensionError(c);
          }

          // クライアント指定のcontentTypeは信用せず、拡張子から一意に決まる値を署名する
          // （偽装したContentTypeでR2に保存されるのを防ぐ。実際のPUTもこの値と一致しないと署名検証で弾かれるため、
          // 署名した値をレスポンスで返しクライアント側のPUTヘッダーに使わせる）
          const key = makeKey(ext);
          const signedContentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
          const presignedUrl = await storage.getPresignedPutUrl(key, signedContentType);

          return c.json({ data: { presignedUrl, key, contentType: signedContentType } });
        },
      )

      // ── POST {resourcePath}/files/confirm ── R2アップロード後のDB登録
      .post(
        `/${resourcePath}/files/confirm`,
        zValidator(
          "json",
          z.object({
            key: z.string().regex(new RegExp(`^${keyPrefix}/[0-9a-f-]+\\.[a-z0-9]+$`, "i")),
            label: z.string().min(1).max(50),
            fileName: z.string().min(1),
          }),
          (r, c) => {
            if (!r.success)
              return c.json(
                { error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } },
                400,
              );
          },
        ),
        async (c) => {
          const actingMember = c.get("member");
          const org = c.get("org");
          const resourceId = getResourceId(c);

          if (!(await resourceExists(resourceId, org.id))) {
            return notFoundError(c, notFoundMessage);
          }
          if (!hasRole(actingMember, "tech")) {
            return forbiddenError(c);
          }

          const { key, label, fileName } = c.req.valid("json");
          const ext = extname(key).toLowerCase();
          if (!isAllowedExt(ext)) {
            return extensionError(c);
          }

          const header = await storage.getFileHeader(key, FILE_SIGNATURE_CHECK_LENGTH);
          if (!header) {
            // R2の一時的な取得失敗と偽装を区別する。取得できないだけではオブジェクトを消さない
            // （他リソースのkeyを誤って/意図的に指定された場合に無関係なファイルを削除してしまうのを防ぐ）
            return uploadVerificationError(c);
          }
          if (!matchesFileSignature(ext, header)) {
            return contentMismatchError(c);
          }

          const created = await createFile(resourceId, {
            label,
            storageKey: key,
            fileName,
            uploadedBy: actingMember.id,
          });

          return c.json({ data: formatFile(org.slug, resourceId, created) }, 201);
        },
      )

      // ── POST {resourcePath}/files ── ファイルアップロード（ローカル開発用・R2未設定時のフォールバック）
      .post(`/${resourcePath}/files`, async (c) => {
        const actingMember = c.get("member");
        const org = c.get("org");
        const resourceId = getResourceId(c);

        if (!(await resourceExists(resourceId, org.id))) {
          return notFoundError(c, notFoundMessage);
        }
        if (!hasRole(actingMember, "tech")) {
          return forbiddenError(c);
        }

        const body = await c.req.parseBody();
        const file = body["file"];
        if (!file || typeof file === "string") {
          return c.json(
            { error: { code: "VALIDATION_ERROR", message: "ファイルを選択してください" } },
            400,
          );
        }
        const labelResult = z.string().min(1).max(50).safeParse(body["label"]);
        if (!labelResult.success) {
          return c.json(
            { error: { code: "VALIDATION_ERROR", message: "ラベルを入力してください" } },
            400,
          );
        }
        const label = labelResult.data;

        const ext = extname(file.name).toLowerCase();
        if (!isAllowedExt(ext)) {
          return extensionError(c);
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
          return contentMismatchError(c);
        }

        const key = makeKey(ext);
        await storage.upload(key, buffer, CONTENT_TYPES[ext] ?? "application/octet-stream");

        const created = await createFile(resourceId, {
          label,
          storageKey: key,
          fileName: file.name,
          uploadedBy: actingMember.id,
        });

        return c.json({ data: formatFile(org.slug, resourceId, created) }, 201);
      })

      // ── GET {resourcePath}/files ── ファイル一覧（全団員閲覧可。招待制リソースは canView で絞り込み）
      .get(`/${resourcePath}/files`, async (c) => {
        const actingMember = c.get("member");
        const org = c.get("org");
        const resourceId = getResourceId(c);

        const access = await checkReadAccess(actingMember, resourceId, org.id);
        if (access === "not_found") return notFoundError(c, notFoundMessage);
        if (access === "forbidden") return notInvitedError(c);

        const files = await listFiles(resourceId);

        return c.json({ data: files.map((f) => formatFile(org.slug, resourceId, f)) });
      })

      // ── DELETE {resourcePath}/files/:fileId ── ファイル削除（admin/tech）
      .delete(`/${resourcePath}/files/:fileId`, async (c) => {
        const actingMember = c.get("member");
        const org = c.get("org");
        const resourceId = getResourceId(c);
        const { fileId } = c.req.param();

        if (!(await resourceExists(resourceId, org.id))) {
          return notFoundError(c, notFoundMessage);
        }

        const file = await findFile(fileId);
        if (!file || file.resourceId !== resourceId) {
          return notFoundError(c, "ファイルが見つかりません");
        }

        if (!hasRole(actingMember, "tech")) {
          return forbiddenError(c);
        }

        await storage.delete(file.storageKey);
        await deleteFile(fileId, resourceId);

        return new Response(null, { status: 204 });
      })

      // ── GET {resourcePath}/files/:fileId/download ── ファイルダウンロード（全団員閲覧可。招待制リソースは canView で絞り込み）
      .get(`/${resourcePath}/files/:fileId/download`, async (c) => {
        const actingMember = c.get("member");
        const org = c.get("org");
        const resourceId = getResourceId(c);
        const { fileId } = c.req.param();

        const access = await checkReadAccess(actingMember, resourceId, org.id);
        if (access === "not_found") return fileErrorPage(404, notFoundMessage);
        if (access === "forbidden") return fileErrorPage(403, "閲覧する権限がありません");

        const file = await findFile(fileId);
        if (!file || file.resourceId !== resourceId) {
          return fileErrorPage(404, "ファイルが見つかりません");
        }

        const download = await storage
          .getFileDownload(file.storageKey, file.fileName)
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
          },
        });
      })
  );
}
