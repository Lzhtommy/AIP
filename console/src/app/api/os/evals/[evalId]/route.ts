import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/** 评测运行详情：所有登录用户可见，透出原始 eval_data / eval_input */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evalId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  const { evalId } = await params;
  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/eval-runs/${encodeURIComponent(evalId)}`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 404) {
      return NextResponse.json(
        { error: { code: "EVAL_NOT_FOUND", message: "评测记录不存在" } },
        { status: 404 },
      );
    }
    if (!res.ok) return UNREACHABLE();
    const e = await res.json();
    return NextResponse.json({
      id: e.id,
      name: e.name ?? e.id,
      component: e.evaluated_component_name ?? null,
      evalType: e.eval_type ?? null,
      targetId: e.agent_id ?? e.team_id ?? e.workflow_id ?? null,
      evalData: e.eval_data ?? null,
      evalInput: e.eval_input ?? null,
      createdAt: e.created_at ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}

/** 删除评测运行，仅 Admin。runtime 侧为 DELETE /eval-runs + {eval_run_ids}。 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ evalId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可删除评测记录" } },
      { status: 403 },
    );
  }
  const { evalId } = await params;
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/eval-runs`, {
      method: "DELETE",
      headers: { ...osHeaders(ctx.endpoint), "content-type": "application/json" },
      body: JSON.stringify({ eval_run_ids: [evalId] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 204) return UNREACHABLE();
    return NextResponse.json({ ok: true });
  } catch {
    return UNREACHABLE();
  }
}
