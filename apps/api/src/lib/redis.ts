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
const INVITE_ACCEPT_MAX = 5;
const INVITE_ACCEPT_WINDOW_S = 900;
const EMAIL_CHANGE_MAX = 3;
const EMAIL_CHANGE_WINDOW_S = 900;
const INQUIRY_MAX = 5;
const INQUIRY_WINDOW_S = 3600;
const ORG_DELETE_MAX = 5;
const ORG_DELETE_WINDOW_S = 900;

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

async function clearRateLimit(prefix: string, ip: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`rl:${prefix}:${ip}`);
  } catch {
    // ignore
  }
}

export function checkLoginRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("login", ip, LOGIN_MAX, LOGIN_WINDOW_S);
}

export function clearLoginRateLimit(ip: string): Promise<void> {
  return clearRateLimit("login", ip);
}

export function checkResetRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("reset", ip, RESET_MAX, RESET_WINDOW_S);
}

export function checkOrgApplicationRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("org-application", ip, ORG_APPLICATION_MAX, ORG_APPLICATION_WINDOW_S);
}

// 既存ユーザーの招待受諾はパスワード照合（総当たり対象）を伴うため、ログインとは別バケットで
// 制限する（同一バケットにすると、無効な招待トークンだけでログインの制限予算を消費できてしまう）
export function checkInviteAcceptRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("invite-accept", ip, INVITE_ACCEPT_MAX, INVITE_ACCEPT_WINDOW_S);
}

export function clearInviteAcceptRateLimit(ip: string): Promise<void> {
  return clearRateLimit("invite-accept", ip);
}

export function checkEmailChangeRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("email-change", ip, EMAIL_CHANGE_MAX, EMAIL_CHANGE_WINDOW_S);
}

// 団体削除はパスワード再確認（総当たり対象）を伴うため、ユーザーID単位で独立したバケットで制限する
export function checkOrgDeleteRateLimit(userId: string): Promise<boolean> {
  return checkRateLimit("org-delete", userId, ORG_DELETE_MAX, ORG_DELETE_WINDOW_S);
}

export function clearOrgDeleteRateLimit(userId: string): Promise<void> {
  return clearRateLimit("org-delete", userId);
}

export function checkInquiryRateLimit(ip: string): Promise<boolean> {
  return checkRateLimit("inquiry", ip, INQUIRY_MAX, INQUIRY_WINDOW_S);
}
