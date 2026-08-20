import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { MeResult } from "./auth-api";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export type SessionMePayload = { data?: MeResult };

// サーバーコンポーネントから /auth/me を取得する共通ガード。未ログインなら /login へ
// redirect() する（Next.js の redirect() は内部的に例外をスローするため、呼び出し側は
// catch した例外に digest プロパティがあれば再スローすること）。
export async function fetchSessionMe(): Promise<SessionMePayload> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie?.value) {
    redirect("/login");
  }

  const res = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Cookie: `session=${sessionCookie.value}` },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect("/login");
  }

  return (await res.json()) as SessionMePayload;
}
