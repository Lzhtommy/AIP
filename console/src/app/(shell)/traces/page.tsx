"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TraceRow {
  traceId: string;
  name: string | null;
  status: string | null;
  duration: number | null;
  totalSpans: number | null;
  errorCount: number | null;
  sessionId: string | null;
  userId: string | null;
  targetId: string | null;
  createdAt: string | null;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

export default function TracesPage() {
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === "admin"))
      .catch(() => {});
  }, []);

  const load = useCallback(async (user?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (user) qs.set("user", user);
      const res = await fetch(`/api/os/traces${qs.size ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "无法获取 Trace 列表");
      }
      setRows((await res.json()).data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(userFilter || undefined);
  }, [userFilter, load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Traces 追踪</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每次运行的执行追踪，点击展开调用树定位耗时与错误。
        </p>
      </div>

      {isAdmin && (
        <input
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="按用户 ID 过滤（Admin）"
          aria-label="按用户过滤"
          className="w-72 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && loading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {!error && !loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          还没有 Trace。运行一次对话后，这里会出现对应的执行追踪。
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <Link
            key={row.traceId}
            href={`/traces/${encodeURIComponent(row.traceId)}`}
            className="block rounded-md border border-border p-3 transition-colors hover:bg-accent/40"
            data-testid="trace-row"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">
                  {row.name ?? row.traceId}
                </span>
                {row.status === "error" || (row.errorCount ?? 0) > 0 ? (
                  <Badge variant="destructive">错误 ×{row.errorCount ?? "?"}</Badge>
                ) : (
                  <Badge variant="secondary">{row.status ?? "ok"}</Badge>
                )}
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatDuration(row.duration)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {row.targetId && <Badge variant="outline">{row.targetId}</Badge>}
              {row.totalSpans !== null && <span>{row.totalSpans} spans</span>}
              {row.createdAt && (
                <span>{new Date(row.createdAt).toLocaleString()}</span>
              )}
              {row.userId && <span className="truncate">用户：{row.userId}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
