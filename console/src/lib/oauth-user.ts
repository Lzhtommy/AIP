import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

/**
 * OAuth 登录的用户关联：按邮箱查找，已存在则复用（同邮箱自动关联），
 * 不存在则创建（开放注册；与密码注册共享「首个账号自动 Admin」规则）。
 */
export async function ensureOAuthUser(
  email: string,
  name?: string | null,
): Promise<Pick<User, "id" | "email" | "role">> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  if (existing) {
    if (name && !existing.name) {
      await db.update(users).set({ name }).where(eq(users.id, existing.id));
    }
    return { id: existing.id, email: existing.email, role: existing.role };
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const role = count === 0 ? ("admin" as const) : ("member" as const);
    const [created] = await tx
      .insert(users)
      .values({ email: normalized, name: name ?? null, role })
      .returning({ id: users.id, email: users.email, role: users.role });
    return created;
  });
}
