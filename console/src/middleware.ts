import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/register"];

export default auth((req) => {
  const { nextUrl } = req;
  if (req.auth) return;
  if (PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p))) return;

  if (nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const login = new URL("/login", nextUrl);
  login.searchParams.set("callbackUrl", nextUrl.pathname);
  return NextResponse.redirect(login);
});

export const config = {
  // 排除静态资源；其余路由全部过守卫
  matcher: ["/((?!_next|favicon.ico|.*\\.\\w+$).*)"],
};
