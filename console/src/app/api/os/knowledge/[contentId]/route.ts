import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/** 删除知识内容，仅 Admin */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可管理知识库内容" } },
      { status: 403 },
    );
  }
  const { contentId } = await params;
  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/knowledge/content/${encodeURIComponent(contentId)}`,
      {
        method: "DELETE",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 404) {
      return NextResponse.json(
        { error: { code: "CONTENT_NOT_FOUND", message: "内容不存在" } },
        { status: 404 },
      );
    }
    if (!res.ok && res.status !== 204) return UNREACHABLE();
    return NextResponse.json({ ok: true });
  } catch {
    return UNREACHABLE();
  }
}
