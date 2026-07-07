import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { endpoints, users } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return null;
  }
  return session;
}

const FORBIDDEN = NextResponse.json(
  { error: { code: "FORBIDDEN", message: "仅管理员可管理端点" } },
  { status: 403 },
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return FORBIDDEN.clone();
  const { id } = await params;
  const payload = await request.json().catch(() => null);

  const patch: Partial<{
    name: string;
    baseUrl: string;
    enabled: boolean;
    securityKeyCiphertext: string;
  }> = {};
  if (typeof payload?.name === "string" && payload.name.trim()) {
    patch.name = payload.name.trim();
  }
  if (typeof payload?.baseUrl === "string" && /^https?:\/\//.test(payload.baseUrl)) {
    patch.baseUrl = payload.baseUrl.trim();
  }
  if (typeof payload?.enabled === "boolean") patch.enabled = payload.enabled;
  // 密钥可选更新：不提供则保留原值；界面上永不回显
  if (typeof payload?.securityKey === "string" && payload.securityKey) {
    patch.securityKeyCiphertext = encryptSecret(payload.securityKey);
  }

  const [updated] = await db
    .update(endpoints)
    .set(patch)
    .where(eq(endpoints.id, id))
    .returning({ id: endpoints.id, name: endpoints.name, enabled: endpoints.enabled });
  if (!updated) {
    return NextResponse.json(
      { error: { code: "ENDPOINT_NOT_FOUND", message: "端点不存在" } },
      { status: 404 },
    );
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return FORBIDDEN.clone();
  const { id } = await params;
  // 清掉指向该端点的用户偏好，让他们回落到首个启用端点
  await db
    .update(users)
    .set({ currentEndpointId: null })
    .where(eq(users.currentEndpointId, id));
  const deleted = await db.delete(endpoints).where(eq(endpoints.id, id)).returning();
  if (deleted.length === 0) {
    return NextResponse.json(
      { error: { code: "ENDPOINT_NOT_FOUND", message: "端点不存在" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
