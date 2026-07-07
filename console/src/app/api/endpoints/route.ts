import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { endpoints, users } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { checkEndpointHealth } from "@/lib/endpoints";

/** 端点列表：所有登录用户可见（切换器用）；baseUrl 仅 Admin 可见；密钥绝不返回 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const isAdmin = session.user.role === "admin";
  const [list, me] = await Promise.all([
    db.query.endpoints.findMany({ orderBy: asc(endpoints.createdAt) }),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);
  return NextResponse.json(
    list.map((ep) => ({
      id: ep.id,
      name: ep.name,
      enabled: ep.enabled,
      current: ep.id === me?.currentEndpointId,
      ...(isAdmin ? { baseUrl: ep.baseUrl } : {}),
    })),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可管理端点" } },
      { status: 403 },
    );
  }

  const payload = await request.json().catch(() => null);
  const name = String(payload?.name ?? "").trim();
  const baseUrl = String(payload?.baseUrl ?? "").trim();
  const securityKey = String(payload?.securityKey ?? "");
  if (!name || !/^https?:\/\//.test(baseUrl) || !securityKey) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "name、baseUrl（http/https）、securityKey 均为必填",
        },
      },
      { status: 400 },
    );
  }

  const health = await checkEndpointHealth(baseUrl, securityKey);
  const [created] = await db
    .insert(endpoints)
    .values({ name, baseUrl, securityKeyCiphertext: encryptSecret(securityKey) })
    .returning({
      id: endpoints.id,
      name: endpoints.name,
      baseUrl: endpoints.baseUrl,
      enabled: endpoints.enabled,
    });
  return NextResponse.json({ ...created, health }, { status: 201 });
}
