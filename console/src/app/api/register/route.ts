import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** drizzle 会把驱动错误包进 cause 链，沿链查找 Postgres 唯一约束错误码 */
function isUniqueViolation(err: unknown): boolean {
  for (let e = err; e instanceof Error; e = e.cause as Error) {
    if ("code" in e && (e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export async function POST(request: Request) {
  let payload: { email?: string; password?: string; name?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "请求体不是合法 JSON" } },
      { status: 400 },
    );
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const name = payload.name?.trim() || null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: { code: "INVALID_EMAIL", message: "邮箱格式不正确" } },
      { status: 400 },
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: {
          code: "WEAK_PASSWORD",
          message: `密码至少 ${MIN_PASSWORD_LENGTH} 位`,
        },
      },
      { status: 400 },
    );
  }

  const passwordHash = await hash(password, 12);

  try {
    const created = await db.transaction(async (tx) => {
      // 锁表内判定是否首个账号，避免并发注册产生两个 Admin
      await tx.execute(sql`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`);
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(users);
      const role = count === 0 ? ("admin" as const) : ("member" as const);
      const [user] = await tx
        .insert(users)
        .values({ email, name, passwordHash, role })
        .returning({ id: users.id, email: users.email, role: users.role });
      return user;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: { code: "EMAIL_TAKEN", message: "该邮箱已注册" } },
        { status: 409 },
      );
    }
    throw err;
  }
}
