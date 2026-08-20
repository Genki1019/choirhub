import type { Context } from "hono";

const IP_REGEX = /^[\d.]+$|^[0-9a-fA-F:]+$/;

export function getClientIp(c: Context): string {
  // Vercel インフラが付与する x-vercel-forwarded-for はクライアントによる偽装不可
  const vercelIp = c.req.header("x-vercel-forwarded-for");
  if (vercelIp) {
    const ip = vercelIp.split(",")[0].trim();
    if (IP_REGEX.test(ip)) return ip;
  }
  // ローカル開発環境フォールバック: XFF 末尾 IP（プロキシ付加分）を信頼
  const forwarded = c.req.header("x-forwarded-for");
  const ips =
    forwarded
      ?.split(",")
      .map((s) => s.trim())
      .filter((ip) => IP_REGEX.test(ip)) ?? [];
  return ips[ips.length - 1] ?? c.req.header("x-real-ip") ?? "unknown";
}
