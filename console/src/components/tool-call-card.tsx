"use client";

import { Badge } from "@/components/ui/badge";
import type { ToolPart } from "@/lib/chat/reducer";

/** 工具调用步骤卡片：实时展示名称/入参/结果，可展开 */
export function ToolCallCard({ part }: { part: ToolPart }) {
  return (
    <details
      className="my-2 rounded-md border border-border bg-background/60 text-sm"
      data-testid="tool-call-card"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 select-none">
        <span className="text-muted-foreground">🔧</span>
        <span className="font-mono text-xs">{part.name}</span>
        {part.status === "running" && <Badge variant="outline">运行中…</Badge>}
        {part.status === "done" && <Badge variant="secondary">完成</Badge>}
        {part.status === "error" && <Badge variant="destructive">失败</Badge>}
      </summary>
      <div className="space-y-2 border-t border-border px-3 py-2">
        {part.args && Object.keys(part.args).length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">入参</p>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(part.args, null, 2)}
            </pre>
          </div>
        )}
        {part.result !== undefined && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">结果</p>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
              {part.result}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
