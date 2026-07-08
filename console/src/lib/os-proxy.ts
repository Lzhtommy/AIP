import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  EndpointKeyError,
  resolveCurrentEndpoint,
  type ResolvedEndpoint,
} from "@/lib/endpoints";

export const ENDPOINT_KEY_INVALID = (name: string) =>
  NextResponse.json(
    {
      error: {
        code: "ENDPOINT_KEY_INVALID",
        message: `端点「${name}」的密钥无法解密（ENCRYPTION_KEY 可能已更换）。请管理员在「端点设置」重新录入该端点的 Security Key`,
      },
    },
    { status: 503 },
  );

export interface OsContext {
  endpoint: ResolvedEndpoint;
  userId: string;
  role: "admin" | "member";
}

/** 解析会话与当前端点；失败时返回结构化错误响应 */
export async function withOsContext(): Promise<OsContext | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "请先登录" } },
      { status: 401 },
    );
  }
  let endpoint;
  try {
    endpoint = await resolveCurrentEndpoint(session.user.id);
  } catch (err) {
    if (err instanceof EndpointKeyError) return ENDPOINT_KEY_INVALID(err.endpointName);
    throw err;
  }
  if (!endpoint) {
    return NextResponse.json(
      { error: { code: "NO_ENDPOINT", message: "尚未配置任何 runtime 端点，请联系管理员" } },
      { status: 503 },
    );
  }
  return { endpoint, userId: session.user.id, role: session.user.role };
}

export function osHeaders(endpoint: ResolvedEndpoint): Record<string, string> {
  return { authorization: `Bearer ${endpoint.securityKey}` };
}

export const UNREACHABLE = () =>
  NextResponse.json(
    {
      error: {
        code: "ENDPOINT_UNREACHABLE",
        message: "无法连接当前 runtime 端点，请联系管理员检查端点配置",
      },
    },
    { status: 502 },
  );
