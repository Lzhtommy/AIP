import { NextResponse } from "next/server";
import { isOsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";
import { KIND_TO_TYPE, mapSessionSummary } from "@/lib/os-sessions";

/**
 * 会话列表。可见性契约：Member 强制按自己的 user_id 过滤（任何客户端参数无效）；
 * Admin 可看全部，并可用 ?user= 过滤指定用户。
 */
export async function GET(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "agents";
  if (!isOsKind(kind)) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_KIND", message: "未知的资源类型" } },
      { status: 404 },
    );
  }

  const upstream = new URLSearchParams({ type: KIND_TO_TYPE[kind] });
  if (ctx.role === "admin") {
    const userFilter = url.searchParams.get("user");
    if (userFilter) upstream.set("user_id", userFilter);
  } else {
    upstream.set("user_id", ctx.userId);
  }
  const page = url.searchParams.get("page");
  if (page) upstream.set("page", page);

  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/sessions?${upstream.toString()}`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      data: (body.data ?? []).map(mapSessionSummary),
      meta: body.meta ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}
