import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/** 调整用户角色（仅 Admin；不能修改自己，防止把系统锁死） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可管理用户" } },
      { status: 403 },
    );
  }
  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: { code: "SELF_ROLE_CHANGE", message: "不能修改自己的角色" } },
      { status: 400 },
    );
  }
  const payload = await request.json().catch(() => null);
  const role = payload?.role;
  if (role !== "admin" && role !== "member") {
    return NextResponse.json(
      { error: { code: "INVALID_ROLE", message: "角色只能是 admin 或 member" } },
      { status: 400 },
    );
  }
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email, role: users.role });
  if (!updated) {
    return NextResponse.json(
      { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
      { status: 404 },
    );
  }
  return NextResponse.json(updated);
}
