import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { endpoints, users } from "@/db/schema";

/** 所有用户：切换自己当前使用的端点（持久化偏好） */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const payload = await request.json().catch(() => null);
  const endpointId = String(payload?.endpointId ?? "");
  const target = await db.query.endpoints.findFirst({
    where: eq(endpoints.id, endpointId),
  });
  if (!target?.enabled) {
    return NextResponse.json(
      { error: { code: "ENDPOINT_NOT_FOUND", message: "端点不存在或已停用" } },
      { status: 404 },
    );
  }
  await db
    .update(users)
    .set({ currentEndpointId: endpointId })
    .where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true, currentEndpointId: endpointId });
}
