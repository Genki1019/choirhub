import { prisma } from "../lib/prisma.js";
import { storage } from "./storage.js";
import { logger } from "../lib/logger.js";

const ORG_DELETION_GRACE_DAYS = 30;

// Vercel関数のmaxDuration(30秒)に収めるため1回の実行で処理する団体数を絞る（残りは翌日以降）
const PURGE_BATCH_SIZE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// 公開デモ等、誰でも管理者としてログインできる団体を削除から守る（環境変数でカンマ区切り指定）
export function isProtectedOrg(slug: string): boolean {
  return (process.env.PROTECTED_ORG_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(slug);
}

export function getPurgeScheduledAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + ORG_DELETION_GRACE_DAYS * DAY_MS);
}

// 団体行を削除するとStoredFileもカスケードで消えR2のキーが辿れなくなるため、R2を先に削除する
export async function purgeExpiredOrgs(now: Date = new Date()): Promise<{ purgedCount: number }> {
  const cutoff = new Date(now.getTime() - ORG_DELETION_GRACE_DAYS * DAY_MS);
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    orderBy: { deletedAt: "asc" },
    take: PURGE_BATCH_SIZE,
    select: { id: true, slug: true },
  });

  let purgedCount = 0;
  for (const org of orgs) {
    try {
      const files = await prisma.storedFile.findMany({
        where: { orgId: org.id },
        select: { storageKey: true },
      });
      await Promise.all(files.map((f) => storage.delete(f.storageKey)));
      await prisma.organization.delete({ where: { id: org.id } });
      purgedCount++;
      logger.info(`[org-purge] 団体を完全削除しました (slug=${org.slug}, files=${files.length})`);
    } catch (err) {
      logger.error(`[org-purge] 団体の完全削除に失敗しました (slug=${org.slug}):`, err);
    }
  }

  return { purgedCount };
}
