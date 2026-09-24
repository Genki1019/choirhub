import { createMiddleware } from "hono/factory";
import { isSystemAdmin } from "../lib/systemAdmin.js";
import type { AuthEnv } from "./auth.js";

export const requireSystemAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  if (!isSystemAdmin(c.get("user").email)) {
    return c.json({ error: { code: "FORBIDDEN", message: "システム管理者権限が必要です" } }, 403);
  }
  await next();
});
