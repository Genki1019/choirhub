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
const ORG_APPLICATION_MAX = 5;
const ORG_APPLICATION_WINDOW_S = 3600;

async function checkRateLimit(
  prefix: string,
  ip: string,
  max: number,
  windowS: number,
): Promise<boolean> {
  if (!redis) return true;
  try {
    const key = `rl:${prefix}:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowS);
    return count <= max;
  } catch {
    return true;
  }
}

export function checkLoginRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("login", ip, LOGIN_MAX, LOGIN_WINDOW_S);
}

export async function clearLoginRateLimit(ip: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`rl:login:${ip}`);
  } catch {
    // ignore
  }
}

export function checkResetRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("reset", ip, RESET_MAX, RESET_WINDOW_S);
}

export function checkOrgApplicationRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("org-application", ip, ORG_APPLICATION_MAX, ORG_APPLICATION_WINDOW_S);
}
