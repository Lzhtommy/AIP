import type { NextAuthConfig } from "next-auth";

/**
 * edge-safe 的 Auth.js 基础配置：不引入数据库/bcrypt，
 * middleware 只用它做 JWT 会话解码。完整配置见 auth.ts。
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as "admin" | "member";
      return session;
    },
  },
} satisfies NextAuthConfig;
