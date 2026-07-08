"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SearchHit {
  id: string | null;
  content: string;
  name: string | null;
  contentId: string | null;
  score: number | null;
}

interface ContentRow {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  size: number | null;
  status: string | null;
  statusMessage: string | null;
  createdAt: string | null;
}

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function StatusBadge({ status, message }: { status: string | null; message: string | null }) {
  if (status === "completed") return <Badge variant="secondary">完成</Badge>;
  if (status === "failed") {
    return <Badge variant="destructive" title={message ?? undefined}>失败</Badge>;
  }
  return <Badge variant="outline">处理中…</Badge>;
}

export default function KnowledgePage() {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<"text" | "url">("text");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === "admin"))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/os/knowledge");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "无法获取知识库内容");
      }
      setRows((await res.json()).data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 有处理中的内容时每 3 秒轮询状态
  useEffect(() => {
    const processing = rows.filter(
      (r) => r.status !== "completed" && r.status !== "failed",
    );
    if (processing.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => void load(), 3_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [rows, load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setNotice(null);
    const res = await fetch("/api/os/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        text: mode === "text" ? text : undefined,
        url: mode === "url" ? url : undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setNotice(body?.error?.message ?? "添加失败");
    } else {
      setNotice("已提交，内容处理中…");
      setName("");
      setDescription("");
      setText("");
      setUrl("");
      await load();
    }
    setPending(false);
  }

  async function onDelete(row: ContentRow) {
    if (!window.confirm(`确认删除「${row.name}」？向量数据将一并清除。`)) return;
    await fetch(`/api/os/knowledge/${encodeURIComponent(row.id)}`, {
      method: "DELETE",
    });
    await load();
  }

  // --- 检索测试 ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch("/api/os/knowledge/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    setResults(res.ok ? ((await res.json()).data ?? []) : []);
    setSearching(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Knowledge 知识库</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent 可检索的知识内容。上传后自动切分并向量化。
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && loading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {!error && !loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          知识库为空。{isAdmin ? "在下方添加第一条内容。" : "请联系管理员添加内容。"}
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-md border border-border p-3"
            data-testid="knowledge-row"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{row.name}</span>
                <StatusBadge status={row.status} message={row.statusMessage} />
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDelete(row)}
                  className="shrink-0 text-sm text-destructive hover:underline"
                >
                  删除
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {row.type && <Badge variant="outline">{row.type}</Badge>}
              {row.size !== null && <span>{formatSize(row.size)}</span>}
              {row.createdAt && <span>{new Date(row.createdAt).toLocaleString()}</span>}
              {row.description && <span className="truncate">{row.description}</span>}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>添加内容</CardTitle>
            <CardDescription>
              支持粘贴文本或抓取 URL。提示：向量化依赖 OpenAI embedding，需配置
              OPENAI_API_KEY。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="flex gap-2">
                {(["text", "url"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      mode === m
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50",
                    )}
                  >
                    {m === "text" ? "粘贴文本" : "抓取 URL"}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label htmlFor="kn-name" className="text-sm text-muted-foreground">
                  名称
                </label>
                <input
                  id="kn-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="kn-desc" className="text-sm text-muted-foreground">
                  描述（可选）
                </label>
                <input
                  id="kn-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                />
              </div>
              {mode === "text" ? (
                <div className="space-y-1">
                  <label htmlFor="kn-text" className="text-sm text-muted-foreground">
                    文本内容
                  </label>
                  <textarea
                    id="kn-text"
                    required
                    rows={6}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className={inputCls}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label htmlFor="kn-url" className="text-sm text-muted-foreground">
                    URL
                  </label>
                  <input
                    id="kn-url"
                    required
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
              {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "提交中…" : "添加内容"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>检索测试</CardTitle>
          <CardDescription>
            输入查询词，查看向量检索命中的片段与相似度，用于验证入库效果。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入查询词…"
              aria-label="检索查询"
              className={inputCls}
            />
            <Button type="submit" disabled={searching}>
              {searching ? "检索中…" : "检索"}
            </Button>
          </form>

          {results !== null && (
            <div className="mt-4 space-y-2" data-testid="search-results">
              {results.length === 0 && (
                <p className="text-sm text-muted-foreground">没有命中任何片段。</p>
              )}
              {results.map((hit, i) => (
                <div
                  key={hit.id ?? i}
                  className="rounded-md border border-border p-3"
                  data-testid="search-hit"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {hit.name && <Badge variant="outline">{hit.name}</Badge>}
                    {hit.score !== null && (
                      <span className="font-mono">相似度 {hit.score.toFixed(3)}</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{hit.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
