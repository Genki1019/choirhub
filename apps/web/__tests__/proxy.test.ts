import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function request(path: string, session?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  if (session) req.cookies.set("session", session);
  return req;
}

function redirectedTo(res: Response): string | null {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  it.each([
    "/",
    "/login",
    "/invite/abc",
    "/password-reset",
    "/password-reset/token-abc",
    "/email-change/token-abc",
    "/apply",
    "/contact",
    "/privacy",
    "/terms",
  ])("未ログインでも公開ページ %s にはアクセスできる", (path) => {
    expect(redirectedTo(proxy(request(path)))).toBeNull();
  });

  it.each(["/tokyo-men-choir", "/contact-choir", "/terms-choir/schedule"])(
    "未ログインで団体ページ %s にアクセスすると /login へリダイレクトする（公開パスと前方一致する団体スラグを含む）",
    (path) => {
      expect(redirectedTo(proxy(request(path)))).toBe("/login");
    },
  );

  it("ログイン済みなら団体ページにアクセスできる", () => {
    expect(redirectedTo(proxy(request("/tokyo-men-choir", "session-abc")))).toBeNull();
  });
});
