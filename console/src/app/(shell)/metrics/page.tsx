"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DayPoint {
  date: string | null;
  runs: number;
  tokens: number;
  users: number;
}

interface MetricsData {
  daily: DayPoint[];
  totals: { runs: number; tokens: number; users: number };
  updatedAt: string | null;
}

function isoDaysAgo(n: number): string {
  // 用固定基准避免 SSR/CSR 偏差；仅取日期部分
  const ms = Date.parse("2026-07-08T00:00:00Z") - n * 86400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

/** 纯 CSS 柱状趋势：无第三方图表依赖 */
function BarChart({
  points,
  value,
  label,
}: {
  points: DayPoint[];
  value: (d: DayPoint) => number;
  label: string;
}) {
  const max = Math.max(1, ...points.map(value));
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{label}</p>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {points.map((d, i) => {
          const v = value(d);
          return (
            <div
              key={d.date ?? i}
              className="flex flex-1 flex-col items-center justify-end"
              title={`${d.date}: ${fmtNumber(v)}`}
            >
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                data-testid="chart-bar"
              />
              <span className="mt-1 text-[10px] text-muted-foreground">
                {d.date?.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const [from, setFrom] = useState(isoDaysAgo(13));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [data, setData] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === "admin"))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/metrics?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "无法获取指标");
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch("/api/os/metrics/refresh", { method: "POST" });
    await load();
    setRefreshing(false);
  }

  const totals = data?.totals;
  const hasData = (data?.daily.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Metrics 指标</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            运行量与 token 用量的按日趋势与区间汇总。
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "刷新中…" : "刷新统计"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted-foreground">从</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="起始日期"
          className="rounded-md border border-input bg-transparent px-2 py-1 outline-none"
        />
        <label className="text-muted-foreground">到</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="结束日期"
          className="rounded-md border border-input bg-transparent px-2 py-1 outline-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && loading && <p className="text-sm text-muted-foreground">加载中…</p>}

      {!error && !loading && (
        <>
          <div className="grid grid-cols-3 gap-4" data-testid="metrics-totals">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">总运行数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtNumber(totals?.runs ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">总 Token</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtNumber(totals?.tokens ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">活跃用户</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtNumber(totals?.users ?? 0)}</p>
              </CardContent>
            </Card>
          </div>

          {hasData ? (
            <Card>
              <CardContent className="space-y-6 pt-6">
                <BarChart points={data!.daily} value={(d) => d.runs} label="每日运行数" />
                <BarChart points={data!.daily} value={(d) => d.tokens} label="每日 Token 消耗" />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              该时间范围内暂无数据。与 Agent 对话产生运行后，
              {isAdmin ? "点「刷新统计」即可看到趋势。" : "指标会陆续出现。"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
