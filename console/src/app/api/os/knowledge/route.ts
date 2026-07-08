import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface UpstreamContent {
  id: string;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  size?: number | null;
  status?: string | null;
  status_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const FORBIDDEN = () =>
  NextResponse.json(
    { error: { code: "FORBIDDEN", message: "仅管理员可管理知识库内容" } },
    { status: 403 },
  );

/** 知识内容列表：所有登录用户可见 */
export async function GET(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const page = new URL(request.url).searchParams.get("page");
  const qs = page ? `?page=${encodeURIComponent(page)}` : "";
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/knowledge/content${qs}`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    return NextResponse.json({
      data: ((body.data ?? []) as UpstreamContent[]).map((c) => ({
        id: c.id,
        name: c.name ?? c.id,
        description: c.description ?? null,
        type: c.type ?? null,
        size: c.size ?? null,
        status: c.status ?? null,
        statusMessage: c.status_message ?? null,
        createdAt: c.created_at ?? null,
        updatedAt: c.updated_at ?? null,
      })),
      meta: body.meta ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}

/** 添加知识内容（文本或 URL），仅 Admin。转发为 runtime 要求的 multipart 表单。 */
export async function POST(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== "admin") return FORBIDDEN();

  const payload = await request.json().catch(() => null);
  const name = String(payload?.name ?? "").trim();
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  const contentUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
  if (!name || (!text && !contentUrl)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "name 必填，且 text 与 url 至少提供一个",
        },
      },
      { status: 400 },
    );
  }

  const form = new FormData();
  form.set("name", name);
  if (typeof payload?.description === "string" && payload.description) {
    form.set("description", payload.description);
  }
  if (text) form.set("text_content", text);
  if (contentUrl) form.set("url", contentUrl);

  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/knowledge/content`, {
      method: "POST",
      headers: osHeaders(ctx.endpoint),
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: { code: "UPLOAD_FAILED", message: `runtime 返回 ${res.status}` } },
        { status: 502 },
      );
    }
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...body });
  } catch {
    return UNREACHABLE();
  }
}
