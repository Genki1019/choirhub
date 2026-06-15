import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app.js";
import { storage } from "./services/storage.js";
import { logger } from "./lib/logger.js";

if (!storage.isR2()) {
  app.use("/uploads/*", serveStatic({ root: "./" }));
}

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  logger.info(`ChoirHub API running on http://localhost:${port}`);
});
