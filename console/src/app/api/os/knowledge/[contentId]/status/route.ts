import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/** 内容处理状态（前端轮询用） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  const { contentId } = await params;
  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/knowledge/content/${encodeURIComponent(contentId)}/status`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      id: body.id,
      status: body.status ?? null,
      statusMessage: body.status_message ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}
