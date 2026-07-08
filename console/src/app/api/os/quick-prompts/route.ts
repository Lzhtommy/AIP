import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/** 读取 AgentOS 配置里某目标的快捷提示词。未配置返回空数组。 */
export async function GET(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const target = new URL(request.url).searchParams.get("target") ?? "";
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/config`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const config = await res.json();
    const map = (config?.chat?.quick_prompts ?? {}) as Record<string, string[]>;
    const prompts = Array.isArray(map[target]) ? map[target] : [];
    return NextResponse.json({ prompts });
  } catch {
    return UNREACHABLE();
  }
}
