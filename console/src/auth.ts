import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureOAuthUser } from "@/lib/oauth-user";

/** OAuth provider 按 env 凭证开关：未配置的不注册、登录页不显示按钮 */
function oauthProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(Google);
  }
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(GitHub);
  }
  return providers;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // OAuth 登录：同邮箱自动关联已有账号，新邮箱开放注册（首个账号 Admin 规则共享）
    async signIn({ account, profile, user }) {
      if (!account || account.provider === "credentials") return true;
      const email = profile?.email ?? user?.email;
      if (!email) return false;
      await ensureOAuthUser(email, profile?.name ?? user?.name);
      return true;
    },
    // OAuth 场景下 user.id 是第三方 id，统一换成控制台数据库的用户 id
    async jwt({ token, user, account }) {
      if (user && account && account.provider !== "credentials") {
        const email = user.email;
        if (email) {
          const dbUser = await ensureOAuthUser(email, user.name);
          token.userId = dbUser.id;
          token.role = dbUser.role;
        }
        return token;
      }
      if (user) {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
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
    ...oauthProviders(),
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
