"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EndpointRow {
  id: string;
  name: string;
  baseUrl?: string;
  enabled: boolean;
  current: boolean;
}

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function EndpointSettingsPage() {
  const [items, setItems] = useState<EndpointRow[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [securityKey, setSecurityKey] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/endpoints");
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setNotice(null);
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, baseUrl, securityKey }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setNotice(body?.error?.message ?? "创建失败");
    } else {
      setNotice(
        body.health?.reachable
          ? `已添加，连通性检测通过（${body.health.version ?? body.health.status ?? "ok"}）`
          : "已添加，但连通性检测未通过，请检查地址与密钥",
      );
      setName("");
      setBaseUrl("");
      setSecurityKey("");
      await load();
      window.dispatchEvent(new Event("endpoint-changed"));
    }
    setPending(false);
  }

  async function onToggle(row: EndpointRow) {
    await fetch(`/api/endpoints/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !row.enabled }),
    });
    await load();
    window.dispatchEvent(new Event("endpoint-changed"));
  }

  async function onDelete(row: EndpointRow) {
    if (!window.confirm(`确认删除端点「${row.name}」？指向它的用户将回落到默认端点。`)) {
      return;
    }
    await fetch(`/api/endpoints/${row.id}`, { method: "DELETE" });
    await load();
    window.dispatchEvent(new Event("endpoint-changed"));
  }

  async function onRotateKey(row: EndpointRow) {
    const key = window.prompt(`为「${row.name}」输入新的 Security Key（原值不回显）：`);
    if (!key) return;
    await fetch(`/api/endpoints/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ securityKey: key }),
    });
    setNotice("密钥已更新");
    window.dispatchEvent(new Event("endpoint-changed"));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">端点设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理可接入的 AgentOS runtime 端点。Security Key 加密存储、永不回显。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已接入端点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">还没有端点，先在下方添加一个。</p>
          )}
          {items.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.name}</span>
                  {!row.enabled && <Badge variant="secondary">已停用</Badge>}
                  {row.current && <Badge>当前</Badge>}
                </div>
                {row.baseUrl && (
                  <p className="truncate text-xs text-muted-foreground">{row.baseUrl}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => onRotateKey(row)}>
                  换密钥
                </Button>
                <Button variant="outline" size="sm" onClick={() => onToggle(row)}>
                  {row.enabled ? "停用" : "启用"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(row)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>添加端点</CardTitle>
          <CardDescription>添加后会自动做连通性检测</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="ep-name" className="text-sm text-muted-foreground">
                名称
              </label>
              <input
                id="ep-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="如：生产 Runtime"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ep-url" className="text-sm text-muted-foreground">
                Base URL
              </label>
              <input
                id="ep-url"
                required
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className={inputCls}
                placeholder="http://runtime.internal:7777"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ep-key" className="text-sm text-muted-foreground">
                Security Key
              </label>
              <input
                id="ep-key"
                required
                type="password"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
                className={inputCls}
              />
            </div>
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "添加中…" : "添加端点"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
