import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamNode {
  id?: string;
  name?: string;
  type?: string;
  duration?: number | null;
  status?: string | null;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  metadata?: Record<string, unknown> | null;
  spans?: UpstreamNode[] | null;
}

export interface TraceTreeNode {
  id: string;
  name: string;
  type: string;
  duration: number | null;
  status: string | null;
  input: string | null;
  output: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  children: TraceTreeNode[];
}

function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : JSON.stringify(v);
}

function mapNode(node: UpstreamNode, index = 0): TraceTreeNode {
  return {
    id: node.id ?? `node-${index}`,
    name: node.name ?? "unnamed",
    type: node.type ?? "span",
    duration: node.duration ?? null,
    status: node.status ?? null,
    input: asText(node.input),
    output: asText(node.output),
    error: asText(node.error),
    metadata: node.metadata ?? null,
    children: (node.spans ?? []).map((child, i) => mapNode(child, i)),
  };
}

/** runtime 的 tree 可能是根节点数组、单节点或缺省，统一成数组 */
function normalizeRoots(tree: unknown): UpstreamNode[] {
  if (Array.isArray(tree)) return tree as UpstreamNode[];
  if (tree && typeof tree === "object") return [tree as UpstreamNode];
  return [];
}

const NOT_FOUND = () =>
  NextResponse.json(
    { error: { code: "TRACE_NOT_FOUND", message: "Trace 不存在" } },
    { status: 404 },
  );

/** Trace 详情（树形结构）。Member 只能访问自己的 trace（越权一律 404）。 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  const { traceId } = await params;

  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/traces/${encodeURIComponent(traceId)}`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 404) return NOT_FOUND();
    if (!res.ok) return UNREACHABLE();
    const detail = await res.json();

    if (ctx.role !== "admin" && detail.user_id !== ctx.userId) {
      return NOT_FOUND();
    }

    return NextResponse.json({
      traceId: detail.trace_id,
      name: detail.name ?? null,
      status: detail.status ?? null,
      duration: detail.duration ?? null,
      totalSpans: detail.total_spans ?? null,
      errorCount: detail.error_count ?? null,
      sessionId: detail.session_id ?? null,
      userId: detail.user_id ?? null,
      // runtime 的 tree 是根节点数组（一个 trace 可有多个根 span）
      roots: normalizeRoots(detail.tree).map((n, i) => mapNode(n, i)),
    });
  } catch {
    return UNREACHABLE();
  }
}
