"use client";

import { useCallback, useEffect, useState } from "react";

interface EndpointItem {
  id: string;
  name: string;
  enabled: boolean;
  current: boolean;
}

/** 全局端点切换器：所有用户可切换自己当前使用的 runtime 端点 */
export function EndpointSwitcher() {
  const [items, setItems] = useState<EndpointItem[]>([]);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/endpoints");
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPending(true);
    await fetch("/api/endpoints/current", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpointId: e.target.value }),
    });
    await load();
    setPending(false);
    // 让状态页等消费方感知端点变化
    window.dispatchEvent(new Event("endpoint-changed"));
  }

  const enabled = items.filter((i) => i.enabled);
  const currentId = items.find((i) => i.current)?.id ?? enabled[0]?.id ?? "";

  return (
    <div className="border-b border-border p-3">
      <label htmlFor="endpoint-switcher" className="mb-1 block text-xs text-muted-foreground">
        当前端点
      </label>
      <select
        id="endpoint-switcher"
        value={currentId}
        onChange={onChange}
        disabled={pending || enabled.length === 0}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none"
      >
        {enabled.length === 0 && <option value="">（无可用端点）</option>}
        {enabled.map((i) => (
          <option key={i.id} value={i.id} className="bg-background">
            {i.name}
          </option>
        ))}
      </select>
    </div>
  );
}
