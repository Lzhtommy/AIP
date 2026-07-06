"use client";

import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function UserMenu({
  email,
  role,
}: {
  email: string;
  role: "admin" | "member";
}) {
  return (
    <div className="space-y-2 border-t border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground" title={email}>
          {email}
        </span>
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {role === "admin" ? "Admin" : "Member"}
        </Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        登出
      </Button>
    </div>
  );
}
