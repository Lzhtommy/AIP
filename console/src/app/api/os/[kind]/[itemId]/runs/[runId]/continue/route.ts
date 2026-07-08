import { NextResponse } from "next/server";
import { isOsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/**
 * 恢复一个因工具审批而暂停的 run：把用户的批准/拒绝决定（tools 上的 confirmed）
 * 透传给 runtime 的 continue 接口，继续以 SSE 流式返回。user_id 强制注入。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string; itemId: string; runId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  const { kind, itemId, runId } = await params;
  if (!isOsKind(kind)) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_KIND", message: "未知的资源类型" } },
      { status: 404 },
    );
  }

  const payload = await request.json().catch(() => null);
  const tools = Array.isArray(payload?.tools) ? payload.tools : [];
  if (tools.length === 0) {
    return NextResponse.json(
      { error: { code: "EMPTY_TOOLS", message: "缺少待确认的工具决定" } },
      { status: 400 },
    );
  }

  const form = new FormData();
  form.set("tools", JSON.stringify(tools));
  form.set("stream", "true");
  form.set("user_id", ctx.userId);
  if (typeof payload?.sessionId === "string" && payload.sessionId) {
    form.set("session_id", payload.sessionId);
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${ctx.endpoint.baseUrl}/${kind}/${encodeURIComponent(itemId)}/runs/${encodeURIComponent(runId)}/continue`,
      {
        method: "POST",
        headers: osHeaders(ctx.endpoint),
        body: form,
        signal: request.signal,
      },
    );
  } catch {
    return UNREACHABLE();
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: { code: "CONTINUE_FAILED", message: `runtime 返回 ${upstream.status}` } },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
