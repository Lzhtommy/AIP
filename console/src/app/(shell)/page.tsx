"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HealthState =
  | { phase: "loading" }
  | { phase: "ok"; runtime: Record<string, unknown> }
  | { phase: "unreachable"; message: string };

export default function StatusPage() {
  const [state, setState] = useState<HealthState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/os/health")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setState({ phase: "ok", runtime: body.runtime ?? {} });
        } else {
          setState({
            phase: "unreachable",
            message: body.error?.message ?? "runtime 不可达",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ phase: "unreachable", message: "无法访问控制台服务" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const version =
    state.phase === "ok" && typeof state.runtime.version === "string"
      ? state.runtime.version
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">系统状态</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          当前 runtime 端点的连接状态与版本信息
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Runtime 端点
            {state.phase === "loading" && <Badge variant="outline">检测中…</Badge>}
            {state.phase === "ok" && <Badge>运行正常</Badge>}
            {state.phase === "unreachable" && (
              <Badge variant="destructive">不可达</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {state.phase === "unreachable"
              ? state.message
              : "控制台通过服务端代理访问 runtime，浏览器不直连。"}
          </CardDescription>
        </CardHeader>
        {state.phase === "ok" && (
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">状态</span>
              <span>{String(state.runtime.status ?? "ok")}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-muted-foreground">版本</span>
              <span>{version ?? "未知"}</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
