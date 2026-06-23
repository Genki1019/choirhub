import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { sessionManager } from "../lib/session.js";

export type AuthEnv = {
  Variables: {
    user: { id: string; nameJa: string; email: string; avatarUrl: string | null };
    session: { id: string; userId: string; expiresAt: Date };
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const sessionId = getCookie(c, sessionManager.sessionCookieName);

  if (!sessionId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);
  }

  const { session, user } = await sessionManager.validateSession(sessionId);

  if (!session || !user) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401);
  }

  c.set("user", { id: user.id, nameJa: user.nameJa, email: user.email, avatarUrl: user.avatarUrl });
  c.set("session", session);

  await next();
});
