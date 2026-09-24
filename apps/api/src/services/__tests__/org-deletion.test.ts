import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    organization: { findMany: vi.fn(), delete: vi.fn() },
    storedFile: { findMany: vi.fn() },
  },
}));

vi.mock("../storage.js", () => ({
  storage: { delete: vi.fn() },
}));

import { prisma } from "../../lib/prisma.js";
import { storage } from "../storage.js";
import { getPurgeScheduledAt, isProtectedOrg, purgeExpiredOrgs } from "../org-deletion.js";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isProtectedOrg", () => {
  afterEach(() => {
    delete process.env.PROTECTED_ORG_SLUGS;
  });

  it("PROTECTED_ORG_SLUGS未設定なら保護しない", () => {
    expect(isProtectedOrg("harmonia")).toBe(false);
  });

  it("カンマ区切り（前後の空白は無視）で列挙されたスラグのみ保護する", () => {
    process.env.PROTECTED_ORG_SLUGS = "harmonia, demo-choir";
    expect(isProtectedOrg("harmonia")).toBe(true);
    expect(isProtectedOrg("demo-choir")).toBe(true);
    expect(isProtectedOrg("harmonia-2")).toBe(false);
  });
});

describe("getPurgeScheduledAt", () => {
  it("削除日時の30日後を返す", () => {
    expect(getPurgeScheduledAt(new Date("2026-09-01T12:00:00Z"))).toEqual(
      new Date("2026-10-01T12:00:00Z"),
    );
  });
});

describe("purgeExpiredOrgs", () => {
  const now = new Date("2026-10-01T02:00:00Z");

  it("削除から30日以上経過した団体のみを、削除日の古い順に上限件数まで対象にする", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([]);

    const result = await purgeExpiredOrgs(now);

    expect(result).toEqual({ purgedCount: 0 });
    expect(prisma.organization.delete).not.toHaveBeenCalled();

    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: { deletedAt: { not: null, lte: new Date("2026-09-01T02:00:00Z") } },
      orderBy: { deletedAt: "asc" },
      take: 3,
      select: { id: true, slug: true },
    });
  });

  it("R2上の団体ファイルを削除してから団体行を削除する", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      { id: "org-1", slug: "tokyo-men-choir" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.storedFile.findMany).mockResolvedValue([
      { storageKey: "scores/s1/a.pdf" },
      { storageKey: "documents/org-1/rules/b.pdf" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const result = await purgeExpiredOrgs(now);

    expect(prisma.storedFile.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      select: { storageKey: true },
    });
    expect(storage.delete).toHaveBeenCalledWith("scores/s1/a.pdf");
    expect(storage.delete).toHaveBeenCalledWith("documents/org-1/rules/b.pdf");
    expect(prisma.organization.delete).toHaveBeenCalledWith({ where: { id: "org-1" } });
    expect(vi.mocked(storage.delete).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(prisma.organization.delete).mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ purgedCount: 1 });
  });

  it("1団体の削除に失敗しても他の団体の処理は続行し、失敗分は件数に含めない", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      { id: "org-1", slug: "failing-choir" },
      { id: "org-2", slug: "ok-choir" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    vi.mocked(prisma.storedFile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.organization.delete)
      .mockRejectedValueOnce(new Error("db error"))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({} as any);

    const result = await purgeExpiredOrgs(now);

    expect(prisma.organization.delete).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ purgedCount: 1 });
  });
});
