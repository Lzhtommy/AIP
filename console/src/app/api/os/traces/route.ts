import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamTraceSummary {
  trace_id: string;
  name?: string | null;
  status?: string | null;
  duration?: number | null;
  total_spans?: number | null;
  error_count?: number | null;
  session_id?: string | null;
  user_id?: string | null;
  agent_id?: string | null;
  team_id?: string | null;
  workflow_id?: string | null;
  created_at?: string | null;
}

/** Trace 列表。可见性与会话一致：Member 强制按自己的 user_id 过滤，Admin 可看全部。 */
export async function GET(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(request.url);
  const upstream = new URLSearchParams();
  if (ctx.role === "admin") {
    const userFilter = url.searchParams.get("user");
    if (userFilter) upstream.set("user_id", userFilter);
  } else {
    upstream.set("user_id", ctx.userId);
  }
  const page = url.searchParams.get("page");
  if (page) upstream.set("page", page);

  const qs = upstream.toString();
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/traces${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      data: ((body.data ?? []) as UpstreamTraceSummary[]).map((t) => ({
        traceId: t.trace_id,
        name: t.name ?? null,
        status: t.status ?? null,
        duration: t.duration ?? null,
        totalSpans: t.total_spans ?? null,
        errorCount: t.error_count ?? null,
        sessionId: t.session_id ?? null,
        userId: t.user_id ?? null,
        targetId: t.agent_id ?? t.team_id ?? t.workflow_id ?? null,
        createdAt: t.created_at ?? null,
      })),
      meta: body.meta ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}
