import { NextResponse } from "next/server";
import { isOsKind, type OsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";
import { buildReplayMessages, KIND_TO_TYPE } from "@/lib/os-sessions";

const NOT_FOUND = () =>
  NextResponse.json(
    { error: { code: "SESSION_NOT_FOUND", message: "会话不存在" } },
    { status: 404 },
  );

/** 删除会话（仅 Admin 的破坏性操作） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可删除会话" } },
      { status: 403 },
    );
  }

  const { sessionId } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "agents";
  if (!isOsKind(kind)) return NOT_FOUND();

  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/sessions/${encodeURIComponent(sessionId)}?type=${KIND_TO_TYPE[kind as OsKind]}`,
      {
        method: "DELETE",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 404) return NOT_FOUND();
    if (!res.ok && res.status !== 204) return UNREACHABLE();
    return NextResponse.json({ ok: true });
  } catch {
    return UNREACHABLE();
  }
}

/** 会话详情 + 回放消息。Member 只能访问自己的会话（越权一律 404，不暴露存在性）。 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const { sessionId } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "agents";
  if (!isOsKind(kind)) return NOT_FOUND();
  const type = KIND_TO_TYPE[kind as OsKind];
  // Member 把 user_id 下推给 runtime 过滤（本地归属校验仍保留，纵深防御）
  const scope =
    ctx.role === "admin" ? "" : `&user_id=${encodeURIComponent(ctx.userId)}`;

  try {
    const detailRes = await fetch(
      `${ctx.endpoint.baseUrl}/sessions/${encodeURIComponent(sessionId)}?type=${type}${scope}`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (detailRes.status === 404) return NOT_FOUND();
    if (!detailRes.ok) return UNREACHABLE();
    const detail = await detailRes.json();

    if (ctx.role !== "admin" && detail.user_id !== ctx.userId) {
      return NOT_FOUND();
    }

    const runsRes = await fetch(
      `${ctx.endpoint.baseUrl}/sessions/${encodeURIComponent(sessionId)}/runs?type=${type}${scope}`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const runs = runsRes.ok ? await runsRes.json() : [];

    return NextResponse.json({
      sessionId: detail.session_id,
      name: detail.session_name ?? null,
      userId: detail.user_id ?? null,
      target: {
        kind,
        id: detail.agent_id ?? detail.team_id ?? detail.workflow_id ?? null,
      },
      messages: buildReplayMessages(
        Array.isArray(runs) ? runs : [],
        detail.chat_history ?? [],
      ),
    });
  } catch {
    return UNREACHABLE();
  }
}
