import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma.js";
import { sessionManager } from "../session.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function testUserFields() {
  return { id: "user-1", email: "test@example.com", nameJa: "山田太郎", avatarUrl: null };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createSession", () => {
  it("isVisitor=falseの場合は30日後に失効する", () => {
    const before = Date.now();
    const session = sessionManager.createSession("user-1", false);

    expect(session.userId).toBe("user-1");
    expect(session.isVisitor).toBe(false);
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 1000);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(before + 30 * DAY_MS + 1000);
  });

  it("isVisitor=trueの場合は24時間後に失効する", () => {
    const before = Date.now();
    const session = sessionManager.createSession("user-1", true);

    expect(session.isVisitor).toBe(true);
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + DAY_MS - 1000);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(before + DAY_MS + 1000);
  });
});

describe("validateSession", () => {
  it("セッションが存在しない場合はnullとrenewed:falseを返す", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const result = await sessionManager.validateSession("nonexistent");

    expect(result).toEqual({ session: null, user: null, renewed: false });
  });

  it("期限切れの場合はセッションを削除しnullを返す", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      expiresAt: new Date(Date.now() - 1000),
      isVisitor: false,
      user: testUserFields(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await sessionManager.validateSession("s1");

    expect(result.session).toBeNull();
    expect(result.renewed).toBe(false);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("通常セッションで残り期間が半分（15日）以上ある場合は延長しない", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 20 * DAY_MS),
      isVisitor: false,
      user: testUserFields(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await sessionManager.validateSession("s1");

    expect(result.renewed).toBe(false);
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it("通常セッションで残り期間が半分（15日）未満の場合は30日へ延長する", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 10 * DAY_MS),
      isVisitor: false,
      user: testUserFields(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.session.update).mockResolvedValue({} as any);

    const result = await sessionManager.validateSession("s1");

    expect(result.renewed).toBe(true);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { expiresAt: expect.any(Date) },
    });
    expect(result.session!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
  });

  it("visitorセッションは残り期間が短くても延長しない", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "s1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 1000),
      isVisitor: true,
      user: testUserFields(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await sessionManager.validateSession("s1");

    expect(result.renewed).toBe(false);
    expect(prisma.session.update).not.toHaveBeenCalled();
  });
});
