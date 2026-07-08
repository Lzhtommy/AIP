import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/** 记忆 topic 列表（筛选器数据源） */
export async function GET() {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/memory_topics`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    return NextResponse.json(await res.json());
  } catch {
    return UNREACHABLE();
  }
}
