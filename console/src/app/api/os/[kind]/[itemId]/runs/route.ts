import { NextResponse } from "next/server";
import { isOsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/**
 * 流式运行 Agent/Team/Workflow：把 runtime 的 SSE 原样透传给浏览器。
 * user_id 由服务端强制注入为控制台登录用户，客户端传入的任何值都被忽略（会话隔离契约）。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string; itemId: string }> },
) {
  const { kind, itemId } = await params;
  if (!isOsKind(kind)) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_KIND", message: "未知的资源类型" } },
      { status: 404 },
    );
  }

  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const payload = await request.json().catch(() => null);
  const message = String(payload?.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { error: { code: "EMPTY_MESSAGE", message: "消息不能为空" } },
      { status: 400 },
    );
  }

  const form = new FormData();
  form.set("message", message);
  form.set("stream", "true");
  form.set("user_id", ctx.userId);
  if (typeof payload?.sessionId === "string" && payload.sessionId) {
    form.set("session_id", payload.sessionId);
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${ctx.endpoint.baseUrl}/${kind}/${encodeURIComponent(itemId)}/runs`,
      {
        method: "POST",
        headers: osHeaders(ctx.endpoint),
        body: form,
        signal: request.signal, // 浏览器中断（stop）会传导到上游
      },
    );
  } catch {
    return UNREACHABLE();
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: { code: "RUN_FAILED", message: `runtime 返回 ${upstream.status}` } },
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
