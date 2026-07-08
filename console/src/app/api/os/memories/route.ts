import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamMemory {
  memory_id: string;
  memory?: string;
  topics?: string[] | null;
  agent_id?: string | null;
  team_id?: string | null;
  user_id?: string | null;
  updated_at?: string | null;
}

/** 记忆列表。可见性与会话一致：Member 强制按自己的 user_id 过滤，Admin 可看全部。 */
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
  const search = url.searchParams.get("search");
  if (search) upstream.set("search_content", search);
  const topic = url.searchParams.get("topic");
  if (topic) upstream.set("topics", topic);
  const page = url.searchParams.get("page");
  if (page) upstream.set("page", page);

  const qs = upstream.toString();
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/memories${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      data: ((body.data ?? []) as UpstreamMemory[]).map((m) => ({
        memoryId: m.memory_id,
        memory: m.memory ?? "",
        topics: m.topics ?? [],
        targetId: m.agent_id ?? m.team_id ?? null,
        userId: m.user_id ?? null,
        updatedAt: m.updated_at ?? null,
      })),
      meta: body.meta ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}
