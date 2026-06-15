import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { membersRouter } from "./routes/members.js";
import { authRouter } from "./routes/auth.js";
import { scoresRouter } from "./routes/scores.js";
import { concertsRouter } from "./routes/concerts.js";
import { mailingRouter } from "./routes/mailing.js";
import { ticketsRouter } from "./routes/tickets.js";
import { eventsRouter } from "./routes/events.js";
import { settingsRouter } from "./routes/settings.js";
import { homeRouter } from "./routes/home.js";
import { accountingRouter } from "./routes/accounting.js";
import { outreachRouter } from "./routes/outreach.js";

const app = new Hono();

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl && process.env.NODE_ENV === "production") {
  throw new Error("FRONTEND_URL 環境変数が設定されていません");
}

const allowedOrigins = new Set([
  "http://localhost:3000",
  ...(frontendUrl ? [frontendUrl] : []),
  ...(process.env.CORS_EXTRA_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
]);

app.use("*", cors({
  origin: (origin) => (allowedOrigins.has(origin) ? origin : undefined),
  credentials: true,
}));

const v1 = new Hono();

v1.route("/", authRouter);

v1.use("/:orgSlug/*", authMiddleware, tenantMiddleware);
v1.route("/:orgSlug", membersRouter);
v1.route("/:orgSlug", scoresRouter);
v1.route("/:orgSlug", concertsRouter);
v1.route("/:orgSlug", mailingRouter);
v1.route("/:orgSlug", ticketsRouter);
v1.route("/:orgSlug", eventsRouter);
v1.route("/:orgSlug", settingsRouter);
v1.route("/:orgSlug", homeRouter);
v1.route("/:orgSlug", accountingRouter);
v1.route("/:orgSlug", outreachRouter);

app.route("/api/v1", v1);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/debug/db", async (c) => {
  const steps: string[] = [];
  try {
    steps.push("start");
    const { neon } = await import("@neondatabase/serverless");
    steps.push("neon_imported");
    const dbUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL ?? "not_set";
    steps.push(`url_prefix:${dbUrl.slice(0, 30)}`);
    const sql = neon(dbUrl);
    steps.push("neon_created");
    const result = await Promise.race([
      sql`SELECT 1 as ok`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout_10s")), 10000)),
    ]);
    steps.push("query_done");
    return c.json({ ok: true, steps, result });
  } catch (e: unknown) {
    steps.push(`error:${(e as Error).message?.slice(0, 100)}`);
    return c.json({ ok: false, steps }, 500);
  }
});

app.post("/debug/login-trace", async (c) => {
  const steps: string[] = [];
  const t = () => Date.now();
  const race = <T>(p: Promise<T>, label: string, ms = 10000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error(`timeout:${label}`)), ms))]);

  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    steps.push("json_parsed");

    const { prisma } = await import("./lib/prisma.js");
    const t1 = t();
    const user = await race(prisma.user.findUnique({ where: { email } }), "findUnique");
    steps.push(`findUnique_ms:${t() - t1}:found=${!!user}`);

    const DUMMY = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const stored = (user as { passwordHash: string } | null)?.passwordHash ?? DUMMY;
    steps.push(`hash_type:${stored.startsWith("$argon2") ? "argon2" : stored.length === 64 ? "sha256" : "unknown"}`);

    const { verify } = await import("argon2");
    const t2 = t();
    const ok = await race(verify(stored, password), "argon2_verify", 15000);
    steps.push(`verify_ms:${t() - t2}:ok=${ok}`);

    if (user && ok) {
      const sessionData = { id: crypto.randomUUID(), userId: (user as { id: string }).id, expiresAt: new Date(Date.now() + 86400000) };
      const t3 = t();
      await race(prisma.session.create({ data: sessionData }), "session_create");
      steps.push(`session_create_ms:${t() - t3}`);

      const t4 = t();
      await race(prisma.member.findMany({ where: { userId: (user as { id: string }).id }, take: 5 }), "member_findMany");
      steps.push(`member_findMany_ms:${t() - t4}`);
    }

    steps.push("done");
    return c.json({ ok: true, steps });
  } catch (e: unknown) {
    steps.push(`ERROR:${(e as Error).message?.slice(0, 200)}`);
    return c.json({ ok: false, steps }, 500);
  }
});

app.get("/debug/argon2", async (c) => {
  const steps: string[] = [];
  try {
    steps.push("start");
    const { verify } = await import("argon2");
    steps.push("argon2_imported");
    const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const t0 = Date.now();
    await Promise.race([
      verify(DUMMY_HASH, "testpassword"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout_15s")), 15000)),
    ]);
    steps.push(`verify_done_ms:${Date.now() - t0}`);
    return c.json({ ok: true, steps });
  } catch (e: unknown) {
    steps.push(`error:${(e as Error).message?.slice(0, 200)}`);
    return c.json({ ok: false, steps }, 500);
  }
});

app.get("/debug/prisma", async (c) => {
  const steps: string[] = [];
  try {
    steps.push("start");
    const { prisma } = await import("./lib/prisma.js");
    steps.push("prisma_imported");
    const result = await Promise.race([
      prisma.user.findMany({ take: 1, select: { id: true } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout_10s")), 10000)),
    ]);
    steps.push("query_done");
    return c.json({ ok: true, steps, count: (result as unknown[]).length });
  } catch (e: unknown) {
    steps.push(`error:${(e as Error).message?.slice(0, 200)}`);
    return c.json({ ok: false, steps }, 500);
  }
});

export { app };
