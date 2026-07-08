import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { endpoints, users, type Endpoint } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export interface ResolvedEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  securityKey: string;
}

/** 端点密钥解不开（ENCRYPTION_KEY 已更换或密文损坏）——需要管理员重新录入 */
export class EndpointKeyError extends Error {
  constructor(public endpointName: string) {
    super(`端点「${endpointName}」的密钥无法解密`);
  }
}

function toResolved(ep: Endpoint): ResolvedEndpoint {
  let securityKey: string;
  try {
    securityKey = decryptSecret(ep.securityKeyCiphertext);
  } catch {
    throw new EndpointKeyError(ep.name);
  }
  return {
    id: ep.id,
    name: ep.name,
    baseUrl: ep.baseUrl.replace(/\/+$/, ""),
    securityKey,
  };
}

/** 解析用户当前生效的端点：个人偏好优先，其次首个启用端点 */
export async function resolveCurrentEndpoint(
  userId: string,
): Promise<ResolvedEndpoint | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.currentEndpointId) {
    const preferred = await db.query.endpoints.findFirst({
      where: eq(endpoints.id, user.currentEndpointId),
    });
    if (preferred?.enabled) return toResolved(preferred);
  }
  const first = await db.query.endpoints.findFirst({
    where: eq(endpoints.enabled, true),
    orderBy: asc(endpoints.createdAt),
  });
  return first ? toResolved(first) : null;
}

export interface EndpointHealth {
  reachable: boolean;
  status?: string;
  version?: string;
}

export async function checkEndpointHealth(
  baseUrl: string,
  securityKey: string,
): Promise<EndpointHealth> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
      headers: { authorization: `Bearer ${securityKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json().catch(() => ({}));
    return { reachable: res.ok, status: data.status, version: data.version };
  } catch {
    return { reachable: false };
  }
}

/**
 * 部署便利：端点表为空且配置了 OS_ENDPOINT_URL 时，自动录入为种子端点。
 * 仅首次启动生效，之后端点一律由 Admin 在界面管理。
 */
export async function seedEndpointFromEnv(): Promise<void> {
  const url = process.env.OS_ENDPOINT_URL;
  const key = process.env.OS_SECURITY_KEY;
  if (!url || !key) return;
  const existing = await db.query.endpoints.findFirst({});
  if (existing) return;
  await db.insert(endpoints).values({
    name: "默认 Runtime",
    baseUrl: url,
    securityKeyCiphertext: encryptSecret(key),
  });
}
