import { NextResponse } from "next/server";
import { isOsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamItem {
  id: string;
  name?: string;
  description?: string;
  model?: { provider?: string; model?: string };
}

const NOT_FOUND = () =>
  NextResponse.json(
    { error: { code: "UNKNOWN_KIND", message: "未知的资源类型" } },
    { status: 404 },
  );

/** 当前端点可用的 Agent/Team/Workflow 列表（精简字段，绝不透传上游内部配置） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!isOsKind(kind)) return NOT_FOUND();

  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/${kind}`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const list = (await res.json()) as UpstreamItem[];
    return NextResponse.json(
      list.map((item) => ({
        id: item.id,
        name: item.name ?? item.id,
        description: item.description,
        model: item.model
          ? { provider: item.model.provider, model: item.model.model }
          : undefined,
      })),
    );
  } catch {
    return UNREACHABLE();
  }
}
