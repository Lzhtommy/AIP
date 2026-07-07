import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // 角色每次请求从数据库刷新：Admin 调整角色即时生效，无需重新登录
    async session({ session, token }) {
      session.user.id = token.userId as string;
      const user = await db.query.users.findFirst({
        where: eq(users.id, token.userId as string),
        columns: { role: true },
      });
      session.user.role = user?.role ?? "member";
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user?.passwordHash) return null;
        if (!(await compare(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
