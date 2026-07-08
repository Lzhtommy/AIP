import { NextResponse } from "next/server";
import { isOsKind, type OsKind } from "@/lib/os-kinds";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamTool {
  name?: string;
  description?: string | null;
  requires_confirmation?: boolean;
}

interface UpstreamMember {
  id?: string;
  name?: string | null;
  role?: string | null;
}

interface UpstreamDetail {
  id: string;
  name?: string | null;
  description?: string | null;
  model?: { provider?: string; model?: string } | null;
  system_message?: { instructions?: string | null } | null;
  knowledge?: unknown;
  memory?: { enable_user_memories?: boolean } | null;
  tools?: { tools?: UpstreamTool[] } | UpstreamTool[] | null;
  members?: UpstreamMember[] | null;
  steps?: Array<{ name?: string }> | null;
}

function toolList(tools: UpstreamDetail["tools"]): UpstreamTool[] {
  if (Array.isArray(tools)) return tools;
  if (tools && Array.isArray(tools.tools)) return tools.tools;
  return [];
}

/** 运行目标（Agent/Team/Workflow）配置详情——只读，供控制台展示。 */
export async function GET(
  _request: Request,
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

  try {
    const res = await fetch(
      `${ctx.endpoint.baseUrl}/${kind}/${encodeURIComponent(itemId)}`,
      {
        cache: "no-store",
        headers: osHeaders(ctx.endpoint),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 404) {
      return NextResponse.json(
        { error: { code: "TARGET_NOT_FOUND", message: "目标不存在" } },
        { status: 404 },
      );
    }
    if (!res.ok) return UNREACHABLE();
    const d = (await res.json()) as UpstreamDetail;

    return NextResponse.json({
      id: d.id,
      name: d.name ?? d.id,
      kind: kind as OsKind,
      description: d.description ?? null,
      model: d.model
        ? { provider: d.model.provider ?? null, model: d.model.model ?? null }
        : null,
      instructions: d.system_message?.instructions ?? null,
      knowledgeEnabled: d.knowledge != null,
      memoryEnabled: d.memory?.enable_user_memories === true,
      tools: toolList(d.tools).map((t) => ({
        name: t.name ?? "unknown",
        description: t.description ?? null,
        requiresConfirmation: t.requires_confirmation === true,
      })),
      members: (d.members ?? []).map((m) => ({
        id: m.id ?? "",
        name: m.name ?? m.id ?? "",
        role: m.role ?? null,
      })),
      steps: (d.steps ?? []).map((s) => s.name ?? "").filter(Boolean),
    });
  } catch {
    return UNREACHABLE();
  }
}
