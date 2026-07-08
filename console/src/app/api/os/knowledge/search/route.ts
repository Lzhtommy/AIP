import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamResult {
  id?: string;
  content?: string;
  name?: string | null;
  content_id?: string | null;
  reranking_score?: number | null;
}

/** 知识库检索测试：转发 query 到 runtime，映射命中片段/来源/相似度。所有登录用户可用。 */
export async function POST(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const payload = await request.json().catch(() => null);
  const query = String(payload?.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { error: { code: "EMPTY_QUERY", message: "查询词不能为空" } },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/knowledge/search`, {
      method: "POST",
      headers: { ...osHeaders(ctx.endpoint), "content-type": "application/json" },
      body: JSON.stringify({ query, max_results: 10 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      data: ((body.data ?? []) as UpstreamResult[]).map((r) => ({
        id: r.id ?? null,
        content: r.content ?? "",
        name: r.name ?? null,
        contentId: r.content_id ?? null,
        score: r.reranking_score ?? null,
      })),
    });
  } catch {
    return UNREACHABLE();
  }
}
