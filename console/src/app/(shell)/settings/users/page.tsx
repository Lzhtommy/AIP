"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  createdAt: string;
}

export default function UserSettingsPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [usersRes, sessionRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/auth/session"),
    ]);
    if (usersRes.ok) setRows(await usersRes.json());
    if (sessionRes.ok) {
      const s = await sessionRes.json();
      setMeId(s?.user?.id ?? null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(row: UserRow, role: "admin" | "member") {
    setNotice(null);
    const res = await fetch(`/api/users/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setNotice(body?.error?.message ?? "修改失败");
      return;
    }
    setNotice(`${row.email} 的角色已更新为 ${role}（即时生效）`);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">用户管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          调整成员角色，变更即时生效（无需对方重新登录）。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>注册用户</CardTitle>
          <CardDescription>开放注册：任何人登录即成为 Member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{row.email}</span>
                  {row.id === meId && <Badge variant="outline">我</Badge>}
                </div>
                {row.name && (
                  <p className="text-xs text-muted-foreground">{row.name}</p>
                )}
              </div>
              <select
                value={row.role}
                disabled={row.id === meId}
                onChange={(e) => changeRole(row, e.target.value as "admin" | "member")}
                aria-label={`${row.email} 的角色`}
                className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none disabled:opacity-50"
              >
                <option value="admin" className="bg-background">
                  Admin
                </option>
                <option value="member" className="bg-background">
                  Member
                </option>
              </select>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
