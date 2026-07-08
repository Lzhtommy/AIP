import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

/** 触发 runtime 重算指标，仅 Admin */
export async function POST() {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可刷新统计" } },
      { status: 403 },
    );
  }
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/metrics/refresh`, {
      method: "POST",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return UNREACHABLE();
    return NextResponse.json({ ok: true });
  } catch {
    return UNREACHABLE();
  }
}
