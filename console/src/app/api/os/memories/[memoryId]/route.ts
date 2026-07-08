import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

const NOT_FOUND = () =>
  NextResponse.json(
    { error: { code: "MEMORY_NOT_FOUND", message: "记忆不存在" } },
    { status: 404 },
  );

/** 删除记忆。Member 只能删自己的（越权一律 404，不暴露存在性），Admin 可删任意。 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memoryId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  const { memoryId } = await params;

  try {
    // 先取详情校验归属（runtime 的 DELETE 需要 user_id）
    const detailRes = await fetch(
      `${ctx.endpoint.baseUrl}/memories/${encodeURIComponent(memoryId)}`,
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

    const qs = detail.user_id
      ? `?user_id=${encodeURIComponent(detail.user_id)}`
      : "";
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/memories/${encodeURIComponent(memoryId)}${qs}`,
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
