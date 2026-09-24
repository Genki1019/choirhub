import { type NextRequest, NextResponse } from "next/server";

// 配下のパス（/password-reset/:token 等）も公開する。前方一致だと /contact-choir のような
// 団体スラグまで公開扱いになるため、完全一致か「/」区切りの配下のみを対象にする
const PUBLIC_PATHS = [
  "/login",
  "/invite",
  "/password-reset",
  "/email-change",
  "/apply",
  "/contact",
  "/privacy",
  "/terms",
  "/api",
];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session");
  if (!session?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icons/).*)"],
};
