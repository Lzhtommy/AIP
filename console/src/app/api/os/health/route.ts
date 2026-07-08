import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { EndpointKeyError, resolveCurrentEndpoint } from "@/lib/endpoints";
import { ENDPOINT_KEY_INVALID } from "@/lib/os-proxy";

export async function GET() {
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
      {
        status: "unconfigured",
        error: { code: "NO_ENDPOINT", message: "尚未配置任何 runtime 端点，请联系管理员" },
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${endpoint.baseUrl}/health`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${endpoint.securityKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json();
    return NextResponse.json({
      status: data.status,
      runtime: data,
      endpoint: { id: endpoint.id, name: endpoint.name },
    });
  } catch {
    return NextResponse.json(
      {
        status: "unreachable",
        endpoint: { id: endpoint.id, name: endpoint.name },
        error: {
          code: "ENDPOINT_UNREACHABLE",
          message: "无法连接当前 runtime 端点，请联系管理员检查端点配置",
        },
      },
      { status: 502 },
    );
  }
}
