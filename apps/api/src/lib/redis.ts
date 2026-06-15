import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const LOGIN_MAX = 5;
const LOGIN_WINDOW_S = 900;
const RESET_MAX = 3;
const RESET_WINDOW_S = 900;

export async function checkLoginRateLimit(ip: string): Promise<boolean> {
  if (!redis) return true;
  const key = `rl:login:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, LOGIN_WINDOW_S);
  return count <= LOGIN_MAX;
}

export async function clearLoginRateLimit(ip: string): Promise<void> {
  if (!redis) return;
  await redis.del(`rl:login:${ip}`);
}

export async function checkResetRateLimit(ip: string): Promise<boolean> {
  if (!redis) return true;
  const key = `rl:reset:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RESET_WINDOW_S);
  return count <= RESET_MAX;
}
