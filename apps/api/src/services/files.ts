import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { storage } from "./storage.js";
import { logger } from "../lib/logger.js";
import type { FileKind, Prisma, StoredFile } from "../generated/prisma/index.js";

export type { FileKind };

const KEY_PREFIX: Record<FileKind, string> = {
  score: "scores",
  concert: "concerts",
  event: "events",
  org_document: "documents",
};

/**
 * R2オブジェクトキーの命名規則を一元化する。
 * scopeId は score/concert/event ではリソースID、org_document ではカテゴリ文字列。
 * 既存ファイルは旧キー（フラット `scores/{uuid}.ext`）のまま残り、新規アップロード分から本規則が適用される。
 */
export function makeStorageKey(kind: FileKind, scopeId: string, ext: string): string {
  return `${KEY_PREFIX[kind]}/${scopeId}/${randomUUID()}${ext}`;
}

/** confirm時、presignで発行したkeyが本当にこのリソース宛てのものかを検証する */
export function keyMatchesScope(kind: FileKind, scopeId: string, key: string): boolean {
  return key.startsWith(`${KEY_PREFIX[kind]}/${scopeId}/`);
}

/** StoredFile作成とドメイン拡張行作成を同一トランザクションで行う（片方だけ成功する状態を防ぐ） */
export async function createStoredFileWithExtension<T>(
  fileData: {
    orgId: string;
    kind: FileKind;
    storageKey: string;
    fileName: string;
    uploadedBy: string;
  },
  createExtension: (tx: Prisma.TransactionClient, storedFile: StoredFile) => Promise<T>,
): Promise<{ storedFile: StoredFile; created: T }> {
  return prisma.$transaction(async (tx) => {
    const storedFile = await tx.storedFile.create({ data: fileData });
    const created = await createExtension(tx, storedFile);
    return { storedFile, created };
  });
}

/** R2上の実体削除 + StoredFile行の削除（各ドメインの拡張テーブル行はFKカスケードで連動削除される） */
export async function deleteStoredFile(params: { id: string; storageKey: string }): Promise<void> {
  await storage.delete(params.storageKey);
  await prisma.storedFile.delete({ where: { id: params.id } });
}

/**
 * Concert/Event等の親リソースを削除する際に使う。
 * 親→ConcertFile/EventFile へのFKカスケードは効くが、そこから先のStoredFileへは
 * カスケードが及ばない（FKの向きが逆）ため、呼び出し側が対象ファイルを削除前に集めて渡す。
 * 親リソース自体の削除は既に完了しているため、ここでの失敗は例外化せずログのみに留める
 * （一部のR2/DBエラーで親リソース削除ごと失敗したように見えるのを防ぐ）。
 */
export async function deleteStoredFiles(
  files: { id: string; storageKey: string }[],
): Promise<void> {
  const results = await Promise.allSettled(files.map((f) => deleteStoredFile(f)));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      logger.error(`StoredFile削除に失敗しました (id=${files[i].id}):`, result.reason);
    }
  });
}
