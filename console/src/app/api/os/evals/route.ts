import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamEval {
  id: string;
  agent_id?: string | null;
  team_id?: string | null;
  workflow_id?: string | null;
  name?: string | null;
  evaluated_component_name?: string | null;
  eval_type?: string | null;
  created_at?: string | null;
}

/** 评测运行列表：所有登录用户可见。支持按 agent 与 eval 类型筛选。 */
export async function GET(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(request.url);
  const upstream = new URLSearchParams();
  const agent = url.searchParams.get("agent");
  if (agent) upstream.set("agent_id", agent);
  const type = url.searchParams.get("type");
  if (type) upstream.set("eval_types", type);
  const page = url.searchParams.get("page");
  if (page) upstream.set("page", page);

  const qs = upstream.toString();
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/eval-runs${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      data: ((body.data ?? []) as UpstreamEval[]).map((e) => ({
        id: e.id,
        name: e.name ?? e.id,
        component: e.evaluated_component_name ?? null,
        evalType: e.eval_type ?? null,
        targetId: e.agent_id ?? e.team_id ?? e.workflow_id ?? null,
        createdAt: e.created_at ?? null,
      })),
      meta: body.meta ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}
