import { NextResponse } from "next/server";
import { isOsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 单张图片上限 10MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * 流式运行 Agent/Team/Workflow：把 runtime 的 SSE 原样透传给浏览器。
 * user_id 由服务端强制注入为控制台登录用户，客户端传入的任何值都被忽略（会话隔离契约）。
 * 支持两种请求体：JSON（纯文本）与 multipart（含图片附件）。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string; itemId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  const { kind, itemId } = await params;
  if (!isOsKind(kind)) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_KIND", message: "未知的资源类型" } },
      { status: 404 },
    );
  }

  const form = new FormData();
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const incoming = await request.formData();
    const message = String(incoming.get("message") ?? "").trim();
    if (!message) {
      return NextResponse.json(
        { error: { code: "EMPTY_MESSAGE", message: "消息不能为空" } },
        { status: 400 },
      );
    }
    form.set("message", message);
    const sessionId = incoming.get("sessionId");
    if (typeof sessionId === "string" && sessionId) {
      form.set("session_id", sessionId);
    }
    // 校验并透传图片附件
    for (const file of incoming.getAll("files")) {
      if (!(file instanceof File)) continue;
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: {
              code: "UNSUPPORTED_FILE",
              message: `仅支持图片（png/jpeg/gif/webp），收到 ${file.type || "未知类型"}`,
            },
          },
          { status: 400 },
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: { code: "FILE_TOO_LARGE", message: "单张图片不能超过 10MB" } },
          { status: 400 },
        );
      }
      form.append("files", file, file.name);
    }
  } else {
    const payload = await request.json().catch(() => null);
    const message = String(payload?.message ?? "").trim();
    if (!message) {
      return NextResponse.json(
        { error: { code: "EMPTY_MESSAGE", message: "消息不能为空" } },
        { status: 400 },
      );
    }
    form.set("message", message);
    if (typeof payload?.sessionId === "string" && payload.sessionId) {
      form.set("session_id", payload.sessionId);
    }
  }

  form.set("stream", "true");
  form.set("user_id", ctx.userId); // 强制注入，覆盖任何客户端值

  let upstream: Response;
  try {
    upstream = await fetch(
      `${ctx.endpoint.baseUrl}/${kind}/${encodeURIComponent(itemId)}/runs`,
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
