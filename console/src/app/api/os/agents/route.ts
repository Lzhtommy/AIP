import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamAgent {
  id: string;
  name?: string;
  model?: { provider?: string; model?: string };
}

/** 当前端点可用的 Agent 列表（精简字段，绝不透传上游内部配置） */
export async function GET() {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/agents`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const list = (await res.json()) as UpstreamAgent[];
    return NextResponse.json(
      list.map((a) => ({
        id: a.id,
        name: a.name ?? a.id,
        model: a.model
          ? { provider: a.model.provider, model: a.model.model }
          : undefined,
      })),
    );
  } catch {
    return UNREACHABLE();
  }
}
