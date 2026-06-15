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

export { app };
