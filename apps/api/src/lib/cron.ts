import type { Context } from "hono";

export function isValidCronSecret(c: Context): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && c.req.header("Authorization") === `Bearer ${secret}`;
}
