import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { membersRouter } from "./routes/members.js";
import { authRouter } from "./routes/auth.js";
import { scoresRouter } from "./routes/scores.js";
import { concertsRouter } from "./routes/concerts.js";
import { formationRouter } from "./routes/formation.js";
import { mailingRouter } from "./routes/mailing.js";
import { ticketsRouter } from "./routes/tickets.js";
import { eventsRouter } from "./routes/events.js";
import { settingsRouter } from "./routes/settings.js";
import { homeRouter } from "./routes/home.js";
import { accountingRouter } from "./routes/accounting.js";
import { outreachRouter } from "./routes/outreach.js";
import { storage } from "./services/storage.js";
import { logger } from "./lib/logger.js";

const app = new Hono();

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl && process.env.NODE_ENV === "production") {
  throw new Error("FRONTEND_URL 環境変数が設定されていません");
}

const allowedOrigins = new Set([
  "http://localhost:3000",
  ...(frontendUrl ? [frontendUrl] : []),
  ...(process.env.CORS_EXTRA_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? []),
]);

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : undefined),
    credentials: true,
  }),
);

const v1 = new Hono();

v1.route("/", authRouter);

v1.use("/:orgSlug/*", authMiddleware, tenantMiddleware);
v1.route("/:orgSlug", membersRouter);
v1.route("/:orgSlug", scoresRouter);
v1.route("/:orgSlug", concertsRouter);
v1.route("/:orgSlug", formationRouter);
v1.route("/:orgSlug", mailingRouter);
v1.route("/:orgSlug", ticketsRouter);
v1.route("/:orgSlug", eventsRouter);
v1.route("/:orgSlug", settingsRouter);
v1.route("/:orgSlug", homeRouter);
v1.route("/:orgSlug", accountingRouter);
v1.route("/:orgSlug", outreachRouter);

// アバター画像配信 (認証不要: プロフィール画像は公開情報)
// R2からプロキシして返すことで Next.js <Image> の外部ドメイン制限を回避
// /:orgSlug/* ミドルウェアを通さないよう v1.route より先に登録
app.get("/api/v1/files/avatar", async (c) => {
  const key = c.req.query("k");
  if (!key || !key.startsWith("avatars/")) {
    return c.json({ error: { code: "BAD_REQUEST", message: "無効なキーです" } }, 400);
  }
  const result = await storage.serveAvatar(key);
  if (result.type === "notfound")
    return c.json({ error: { code: "NOT_FOUND", message: "画像が見つかりません" } }, 404);
  return new Response(result.data, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
});

app.route("/api/v1", v1);

app.get("/health", (c) => c.json({ ok: true }));

app.onError((err, c) => {
  logger.error(
    "[Hono] Unhandled error:",
    err instanceof Error ? err.message : String(err),
    err instanceof Error ? err.stack : "",
  );
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
    500,
  );
});

export { app };
