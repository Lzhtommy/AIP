"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Kind = "agents" | "teams" | "workflows";
const KIND_TABS: Array<{ kind: Kind; label: string }> = [
  { kind: "agents", label: "Agent 会话" },
  { kind: "teams", label: "Team 会话" },
  { kind: "workflows", label: "Workflow 会话" },
];

interface SessionRow {
  sessionId: string;
  name: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  userId: string | null;
  targetId: string | null;
}

export default function SessionsPage() {
  const [kind, setKind] = useState<Kind>("agents");
  const [rows, setRows] = useState<SessionRow[]>([]);
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

  const load = useCallback(async (k: Kind, user?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ kind: k });
      if (user) qs.set("user", user);
      const res = await fetch(`/api/os/sessions?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "无法获取会话列表");
      }
      const body = await res.json();
      setRows(body.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(kind, userFilter || undefined);
  }, [kind, userFilter, load]);

  async function onDelete(row: SessionRow, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`确认删除会话「${row.name ?? row.sessionId}」？此操作不可恢复。`)) return;
    await fetch(`/api/os/sessions/${encodeURIComponent(row.sessionId)}?kind=${kind}`, {
      method: "DELETE",
    });
    await load(kind, userFilter || undefined);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sessions 会话</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          历史会话列表，点击查看完整回放。
        </p>
      </div>

      <div className="flex gap-2">
        {KIND_TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => setKind(t.kind)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              kind === t.kind
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {t.label}
          </button>
        ))}
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
        <p className="text-sm text-muted-foreground">还没有会话，去 Chat 页发起一次对话吧。</p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <Link
            key={row.sessionId}
            href={`/sessions/${encodeURIComponent(row.sessionId)}?kind=${kind}`}
            className="block rounded-md border border-border p-3 transition-colors hover:bg-accent/40"
            data-testid="session-row"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">
                {row.name ?? row.sessionId}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : ""}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
                {row.targetId && <Badge variant="outline">{row.targetId}</Badge>}
                {row.userId && <span className="truncate">用户：{row.userId}</span>}
              </div>
              {isAdmin && (
                <button
                  onClick={(e) => onDelete(row, e)}
                  className="shrink-0 text-destructive hover:underline"
                >
                  删除
                </button>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
