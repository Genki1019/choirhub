import { prisma } from "./prisma.js";

export const sessionManager = {
  sessionCookieName: "session",

  async validateSession(sessionId: string): Promise<{
    session: { id: string; userId: string; expiresAt: Date } | null;
    user: { id: string; email: string; nameJa: string; avatarUrl: string | null } | null;
  }> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.deleteMany({ where: { id: sessionId } });
      return { session: null, user: null };
    }

    return {
      session: { id: session.id, userId: session.userId, expiresAt: session.expiresAt },
      user: {
        id: session.user.id,
        email: session.user.email,
        nameJa: session.user.nameJa,
        avatarUrl: session.user.avatarUrl,
      },
    };
  },

  createSession(userId: string): { id: string; userId: string; expiresAt: Date } {
    return {
      id: crypto.randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  },
};
