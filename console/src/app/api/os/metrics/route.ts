import { NextResponse } from "next/server";
import { osHeaders, UNREACHABLE, withOsContext } from "@/lib/os-proxy";

interface DayMetrics {
  date?: string;
  agent_runs_count?: number;
  team_runs_count?: number;
  workflow_runs_count?: number;
  users_count?: number;
  token_metrics?: { total_tokens?: number; input_tokens?: number; output_tokens?: number } | null;
}

function dayRuns(d: DayMetrics): number {
  return (
    (d.agent_runs_count ?? 0) +
    (d.team_runs_count ?? 0) +
    (d.workflow_runs_count ?? 0)
  );
}

function dayTokens(d: DayMetrics): number {
  const t = d.token_metrics;
  if (!t) return 0;
  return (
    t.total_tokens ??
    (t.input_tokens ?? 0) + (t.output_tokens ?? 0)
  );
}

/** 用量指标：按日序列 + 区间汇总。日期范围透传给 runtime。所有登录用户可查看。 */
export async function GET(request: Request) {
  const ctx = await withOsContext();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(request.url);
  const upstream = new URLSearchParams();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) upstream.set("starting_date", from);
  if (to) upstream.set("ending_date", to);

  const qs = upstream.toString();
  try {
    const res = await fetch(`${ctx.endpoint.baseUrl}/metrics${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
      headers: osHeaders(ctx.endpoint),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return UNREACHABLE();
    const body = await res.json();
    const days = (body.metrics ?? []) as DayMetrics[];
    const daily = days.map((d) => ({
      date: d.date ?? null,
      runs: dayRuns(d),
      tokens: dayTokens(d),
      users: d.users_count ?? 0,
    }));
    return NextResponse.json({
      daily,
      totals: {
        runs: daily.reduce((s, d) => s + d.runs, 0),
        tokens: daily.reduce((s, d) => s + d.tokens, 0),
        users: daily.reduce((m, d) => Math.max(m, d.users), 0),
      },
      updatedAt: body.updated_at ?? null,
    });
  } catch {
    return UNREACHABLE();
  }
}
