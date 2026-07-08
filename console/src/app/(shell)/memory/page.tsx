"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MemoryRow {
  memoryId: string;
  memory: string;
  topics: string[];
  targetId: string | null;
  userId: string | null;
  updatedAt: string | null;
}

export default function MemoryPage() {
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === "admin"))
      .catch(() => {});
    fetch("/api/os/memories/topics")
      .then((r) => (r.ok ? r.json() : []))
      .then((t: string[]) => setTopics(t))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (opts: { search?: string; topic?: string | null; user?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (opts.search) qs.set("search", opts.search);
        if (opts.topic) qs.set("topic", opts.topic);
        if (opts.user) qs.set("user", opts.user);
        const res = await fetch(`/api/os/memories${qs.size ? `?${qs}` : ""}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "无法获取记忆列表");
        }
        setRows((await res.json()).data ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({ search, topic: activeTopic, user: userFilter || undefined });
  }, [search, activeTopic, userFilter, load]);

  async function onDelete(row: MemoryRow) {
    if (!window.confirm("确认删除这条记忆？此操作不可恢复。")) return;
    await fetch(`/api/os/memories/${encodeURIComponent(row.memoryId)}`, {
      method: "DELETE",
    });
    await load({ search, topic: activeTopic, user: userFilter || undefined });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Memory 记忆</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent 在对话中沉淀的用户记忆，可搜索、按 topic 筛选与删除。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索记忆内容…"
          aria-label="搜索记忆"
          className="w-64 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {isAdmin && (
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="按用户 ID 过滤（Admin）"
            aria-label="按用户过滤"
            className="w-64 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        )}
      </div>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTopic(null)}
            className={cn(
              "rounded-md px-3 py-1 text-sm transition-colors",
              activeTopic === null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            全部
          </button>
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTopic(t === activeTopic ? null : t)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                activeTopic === t
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && loading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {!error && !loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          还没有记忆。与 Agent 多聊几轮，它会自动沉淀对你的了解。
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.memoryId}
            className="rounded-md border border-border p-3"
            data-testid="memory-row"
          >
            <p className="text-sm">{row.memory}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {row.topics.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
                {row.targetId && <span>来源：{row.targetId}</span>}
                {row.updatedAt && (
                  <span>{new Date(row.updatedAt).toLocaleString()}</span>
                )}
                {isAdmin && row.userId && (
                  <span className="truncate">用户：{row.userId}</span>
                )}
              </div>
              <button
                onClick={() => onDelete(row)}
                className="shrink-0 text-destructive hover:underline"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
