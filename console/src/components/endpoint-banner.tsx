"use client";

import { useCallback, useEffect, useState } from "react";

/** 当前端点不可达/未配置时的全局错误横幅 */
export function EndpointBanner() {
  const [message, setMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/os/health");
      if (res.ok) {
        setMessage(null);
        return;
      }
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "runtime 端点异常");
    } catch {
      setMessage("无法访问控制台服务");
    }
  }, []);

  useEffect(() => {
    void check();
    window.addEventListener("endpoint-changed", check);
    return () => window.removeEventListener("endpoint-changed", check);
  }, [check]);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
