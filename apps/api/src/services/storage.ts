import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { extname, resolve } from "path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../lib/logger.js";

export const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mid": "audio/midi",
  ".midi": "audio/midi",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string | null;
};

function getR2Config(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL ?? null,
  };
}

let _s3: S3Client | null = null;
function getS3(cfg: R2Config): S3Client {
  return (_s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  }));
}

// `/uploads/avatars/UUID.jpg` → `avatars/UUID.jpg`
function normalizeKey(keyOrLegacyPath: string): string {
  return keyOrLegacyPath.startsWith("/uploads/")
    ? keyOrLegacyPath.slice("/uploads/".length)
    : keyOrLegacyPath;
}

const UPLOADS_BASE = resolve("./uploads");

/** ローカルモード用: パストラバーサルを防ぎ絶対パスを返す */
function localPath(key: string): string {
  const full = resolve(UPLOADS_BASE, key);
  if (!full.startsWith(UPLOADS_BASE + "/")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return full;
}

export const storage = {
  isR2(): boolean {
    return getR2Config() !== null;
  },

  /** storage key または旧形式パス → アクセス可能な URL（同期） */
  resolveAvatarUrl(keyOrUrl: string | null): string | null {
    if (!keyOrUrl) return null;
    const key = normalizeKey(keyOrUrl);
    const cfg = getR2Config();
    // R2_PUBLIC_URL が設定されていれば直接 CDN URL を返す
    if (cfg?.publicUrl) return `${cfg.publicUrl}/${key}`;
    // 未設定時は API 経由でプレサインド URL リダイレクト
    if (cfg) return `/api/v1/files/avatar?k=${encodeURIComponent(key)}`;
    // ローカル開発: /uploads/ 経由
    return `/uploads/${key}`;
  },

  /**
   * アバター画像を配信する（R2: 署名URL経由でフェッチしてプロキシ / ローカル: Buffer 返却）
   * リダイレクトではなくプロキシにすることで Next.js <Image> の外部ドメイン制限を回避する。
   */
  async serveAvatar(
    key: string,
  ): Promise<{ type: "buffer"; data: Buffer; contentType: string } | { type: "notfound" }> {
    const cfg = getR2Config();
    if (cfg) {
      try {
        const presignedUrl = await getSignedUrl(
          getS3(cfg),
          new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
          { expiresIn: 60 },
        );
        const res = await fetch(presignedUrl);
        if (!res.ok) return { type: "notfound" };
        const data = Buffer.from(await res.arrayBuffer());
        const contentType =
          res.headers.get("content-type") ??
          CONTENT_TYPES[extname(key).toLowerCase()] ??
          "image/jpeg";
        return { type: "buffer", data, contentType };
      } catch {
        return { type: "notfound" };
      }
    }
    try {
      const data = await readFile(localPath(key));
      const contentType = CONTENT_TYPES[extname(key).toLowerCase()] ?? "image/jpeg";
      return { type: "buffer", data, contentType };
    } catch {
      return { type: "notfound" };
    }
  },

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const cfg = getR2Config();
    if (cfg) {
      await getS3(cfg).send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } else {
      const filePath = localPath(key);
      await mkdir(filePath.substring(0, filePath.lastIndexOf("/")), { recursive: true });
      await writeFile(filePath, buffer);
    }
  },

  /** storage key または旧形式パス（`/uploads/...`）どちらでも削除できる */
  async delete(keyOrUrl: string | null): Promise<void> {
    if (!keyOrUrl) return;
    const key = normalizeKey(keyOrUrl);
    const cfg = getR2Config();
    if (cfg) {
      await getS3(cfg)
        .send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
        .catch((err: unknown) => {
          logger.warn(`[storage] R2 delete failed: ${key}`, err);
        });
    } else {
      await unlink(localPath(key)).catch((err: unknown) => {
        logger.warn(`[storage] local delete failed: ${key}`, err);
      });
    }
  },

  /**
   * R2 プレサインド PUT URL を発行（ブラウザ直接アップロード用）。
   * R2 が未設定のローカル環境では null を返す。
   */
  async getPresignedPutUrl(key: string, contentType: string): Promise<string | null> {
    const cfg = getR2Config();
    if (!cfg) return null;
    return getSignedUrl(
      getS3(cfg),
      new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
  },

  /**
   * スコアファイルのダウンロード。
   * - ローカル: ファイルを読み込んでバッファを返す
   * - R2: Presigned URL（5分有効）へのリダイレクトを返す
   */
  async getScoreDownload(
    key: string,
    filename: string,
  ): Promise<
    | { type: "buffer"; data: Buffer; contentType: string; disposition: string }
    | { type: "redirect"; url: string }
  > {
    const cfg = getR2Config();
    const ext = extname(key).toLowerCase();
    const disposition =
      ext === ".pdf"
        ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
        : `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

    if (cfg) {
      const url = await getSignedUrl(
        getS3(cfg),
        new GetObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          ResponseContentDisposition: disposition,
        }),
        { expiresIn: 300 },
      );
      return { type: "redirect", url };
    }

    const data = await readFile(localPath(key));
    return {
      type: "buffer",
      data,
      contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
      disposition,
    };
  },
};
