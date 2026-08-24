import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuthEnv } from "../auth.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<Record<string, any>>;
}

vi.mock("../../lib/session.js", () => ({
  sessionManager: { sessionCookieName: "session", validateSession: vi.fn() },
  setSessionCookie: vi.fn(),
}));

import { sessionManager, setSessionCookie } from "../../lib/session.js";
import { authMiddleware } from "../auth.js";

function createTestApp() {
  const app = new Hono<AuthEnv>();
  app.use("*", authMiddleware);
  app.get("/ping", (c) => c.json({ data: { userId: c.get("user").id } }));
  return app;
}

const testUser = { id: "user-1", nameJa: "山田太郎", email: "yamada@example.com", avatarUrl: null };
const testSession = {
  id: "session-1",
  userId: "user-1",
  expiresAt: new Date("2027-01-01"),
  isVisitor: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("authMiddleware", () => {
  it("Cookieなし: 401を返す", async () => {
    const app = createTestApp();
    const res = await app.request("/ping");

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("セッションが無効: 401を返す", async () => {
    vi.mocked(sessionManager.validateSession).mockResolvedValue({
      session: null,
      user: null,
      renewed: false,
    });

    const app = createTestApp();
    const res = await app.request("/ping", { headers: { Cookie: "session=invalid" } });

    expect(res.status).toBe(401);
  });

  it("延長が起きなかった場合はCookieを再設定しない", async () => {
    vi.mocked(sessionManager.validateSession).mockResolvedValue({
      session: testSession,
      user: testUser,
      renewed: false,
    });

    const app = createTestApp();
    const res = await app.request("/ping", { headers: { Cookie: "session=session-1" } });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({ userId: "user-1" });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("延長が起きた場合はCookieを新しい有効期限で再設定する", async () => {
    vi.mocked(sessionManager.validateSession).mockResolvedValue({
      session: testSession,
      user: testUser,
      renewed: true,
    });

    const app = createTestApp();
    const res = await app.request("/ping", { headers: { Cookie: "session=session-1" } });

    expect(res.status).toBe(200);
    expect(setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      testSession.id,
      testSession.expiresAt,
    );
  });
});
