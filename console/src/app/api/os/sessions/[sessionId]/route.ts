import { NextResponse } from "next/server";
import { isOsKind, type OsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";
import { buildReplayMessages, KIND_TO_TYPE } from "@/lib/os-sessions";

const NOT_FOUND = () =>
  NextResponse.json(
    { error: { code: "SESSION_NOT_FOUND", message: "会话不存在" } },
    { status: 404 },
  );

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

  try {
    const detailRes = await fetch(
      `${ctx.endpoint.baseUrl}/sessions/${encodeURIComponent(sessionId)}?type=${type}`,
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
      `${ctx.endpoint.baseUrl}/sessions/${encodeURIComponent(sessionId)}/runs?type=${type}`,
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
