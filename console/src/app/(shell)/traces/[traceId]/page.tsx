"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TreeNode {
  id: string;
  name: string;
  type: string;
  duration: number | null;
  status: string | null;
  input: string | null;
  output: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  children: TreeNode[];
}

interface TraceDetail {
  traceId: string;
  name: string | null;
  status: string | null;
  duration: number | null;
  totalSpans: number | null;
  errorCount: number | null;
  sessionId: string | null;
  roots: TreeNode[];
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function tokenInfo(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const input = metadata.input_tokens;
  const output = metadata.output_tokens;
  if (typeof input !== "number" && typeof output !== "number") return null;
  return `tokens ${input ?? "?"}↑ ${output ?? "?"}↓`;
}

function TraceNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const failed = node.status === "error" || !!node.error;
  const tokens = tokenInfo(node.metadata);
  return (
    <div data-testid="trace-node">
      <details open={failed} className="group">
        <summary
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm select-none hover:bg-accent/40",
            failed && "bg-destructive/10",
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <span className="text-muted-foreground">
            {node.children.length > 0 ? "▸" : "·"}
          </span>
          <span className={cn("truncate", failed && "text-destructive")}>
            {node.name}
          </span>
          <Badge variant="outline" className="shrink-0">
            {node.type}
          </Badge>
          {failed && <Badge variant="destructive">错误</Badge>}
          {tokens && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {tokens}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
            {formatDuration(node.duration)}
          </span>
        </summary>
        <div
          className="space-y-2 py-2 text-xs"
          style={{ paddingLeft: `${depth * 20 + 32}px` }}
        >
          {node.error && (
            <div>
              <p className="mb-1 text-destructive">错误详情</p>
              <pre className="max-h-40 overflow-auto rounded bg-destructive/10 p-2 whitespace-pre-wrap text-destructive">
                {node.error}
              </pre>
            </div>
          )}
          {node.input && (
            <div>
              <p className="mb-1 text-muted-foreground">输入</p>
              <pre className="max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                {node.input}
              </pre>
            </div>
          )}
          {node.output && (
            <div>
              <p className="mb-1 text-muted-foreground">输出</p>
              <pre className="max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                {node.output}
              </pre>
            </div>
          )}
        </div>
      </details>
      {node.children.map((child) => (
        <TraceNodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function TraceDetailPage() {
  const params = useParams<{ traceId: string }>();
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/os/traces/${encodeURIComponent(params.traceId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Trace 不存在");
        }
        setDetail(await res.json());
      })
      .catch((e: Error) => setError(e.message));
  }, [params.traceId]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/traces" className="text-sm underline">
          返回 Trace 列表
        </Link>
      </div>
    );
  }
  if (!detail) return <p className="text-sm text-muted-foreground">加载中…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">
            {detail.name ?? detail.traceId}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>总耗时 {formatDuration(detail.duration)}</span>
            {detail.totalSpans !== null && <span>{detail.totalSpans} spans</span>}
            {(detail.errorCount ?? 0) > 0 && (
              <Badge variant="destructive">错误 ×{detail.errorCount}</Badge>
            )}
            {detail.sessionId && <span>会话：{detail.sessionId}</span>}
          </div>
        </div>
        <Link
          href="/traces"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          返回列表
        </Link>
      </div>

      <div className="rounded-md border border-border p-2" data-testid="trace-tree">
        {detail.roots.length > 0 ? (
          detail.roots.map((root, i) => (
            <TraceNodeRow key={root.id ?? i} node={root} depth={0} />
          ))
        ) : (
          <p className="p-2 text-sm text-muted-foreground">该 Trace 没有调用树数据。</p>
        )}
      </div>
    </div>
  );
}
