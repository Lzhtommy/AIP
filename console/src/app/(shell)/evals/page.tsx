"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EvalRow {
  id: string;
  name: string;
  component: string | null;
  evalType: string | null;
  targetId: string | null;
  createdAt: string | null;
}

interface EvalDetail extends EvalRow {
  evalData: unknown;
  evalInput: unknown;
}

const TYPE_TABS: Array<{ value: string; label: string }> = [
  { value: "", label: "全部" },
  { value: "accuracy", label: "Accuracy" },
  { value: "performance", label: "Performance" },
  { value: "reliability", label: "Reliability" },
];

export default function EvalsPage() {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [detail, setDetail] = useState<EvalDetail | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === "admin"))
      .catch(() => {});
  }, []);

  const load = useCallback(async (type: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = type ? `?type=${type}` : "";
      const res = await fetch(`/api/os/evals${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "无法获取评测记录");
      }
      setRows((await res.json()).data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(typeFilter);
  }, [typeFilter, load]);

  async function openDetail(row: EvalRow) {
    const res = await fetch(`/api/os/evals/${encodeURIComponent(row.id)}`);
    if (res.ok) setDetail(await res.json());
  }

  async function onDelete(row: EvalRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`确认删除评测「${row.name}」？`)) return;
    await fetch(`/api/os/evals/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    if (detail?.id === row.id) setDetail(null);
    await load(typeFilter);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Evals 评测</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent/Team/Workflow 的评测运行记录与评分详情。
        </p>
      </div>

      <div className="flex gap-2">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              typeFilter === t.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && loading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {!error && !loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          还没有评测记录。运行评测脚本（见 runtime/scripts/demo_eval.py）后这里会出现结果。
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.id}
            onClick={() => openDetail(row)}
            className="block w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent/40"
            data-testid="eval-row"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{row.name}</span>
                {row.evalType && <Badge variant="outline">{row.evalType}</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {row.createdAt && <span>{new Date(row.createdAt).toLocaleString()}</span>}
                {isAdmin && (
                  <span
                    onClick={(e) => onDelete(row, e)}
                    className="text-destructive hover:underline"
                  >
                    删除
                  </span>
                )}
              </div>
            </div>
            {row.targetId && (
              <p className="mt-1 text-xs text-muted-foreground">目标：{row.targetId}</p>
            )}
          </button>
        ))}
      </div>

      {detail && (
        <div
          className="rounded-md border border-border p-4"
          data-testid="eval-detail"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{detail.name}</h2>
            <button
              onClick={() => setDetail(null)}
              className="text-sm text-muted-foreground hover:underline"
            >
              关闭
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">评分数据</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(detail.evalData, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">输入</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(detail.evalInput, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
