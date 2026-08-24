import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { prisma } from "./prisma.js";

const VISITOR_SESSION_MS = 24 * 60 * 60 * 1000;
const REGULAR_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RENEWAL_THRESHOLD_MS = REGULAR_SESSION_MS / 2;

export const sessionManager = {
  sessionCookieName: "session",

  async validateSession(sessionId: string): Promise<{
    session: { id: string; userId: string; expiresAt: Date; isVisitor: boolean } | null;
    user: { id: string; email: string; nameJa: string; avatarUrl: string | null } | null;
    renewed: boolean;
  }> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.deleteMany({ where: { id: sessionId } });
      return { session: null, user: null, renewed: false };
    }

    let expiresAt = session.expiresAt;
    let renewed = false;

    // visitorは意図的に延長しない（常に固定24時間で失効させる）
    if (!session.isVisitor && expiresAt.getTime() - Date.now() < RENEWAL_THRESHOLD_MS) {
      expiresAt = new Date(Date.now() + REGULAR_SESSION_MS);
      await prisma.session.update({ where: { id: sessionId }, data: { expiresAt } });
      renewed = true;
    }

    return {
      session: { id: session.id, userId: session.userId, expiresAt, isVisitor: session.isVisitor },
      user: {
        id: session.user.id,
        email: session.user.email,
        nameJa: session.user.nameJa,
        avatarUrl: session.user.avatarUrl,
      },
      renewed,
    };
  },

  createSession(
    userId: string,
    isVisitor: boolean,
  ): { id: string; userId: string; expiresAt: Date; isVisitor: boolean } {
    return {
      id: crypto.randomUUID(),
      userId,
      isVisitor,
      expiresAt: new Date(Date.now() + (isVisitor ? VISITOR_SESSION_MS : REGULAR_SESSION_MS)),
    };
  },
};

export function setSessionCookie(c: Context, sessionId: string, expiresAt: Date): void {
  setCookie(c, sessionManager.sessionCookieName, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}
