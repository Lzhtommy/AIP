"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EndpointSwitcher } from "@/components/endpoint-switcher";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar({
  userMenu,
  isAdmin = false,
}: {
  userMenu?: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <Link href="/" className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-base font-semibold tracking-tight">AIP Console</span>
      </Link>
      <EndpointSwitcher />
      <nav aria-label="主导航" className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <Link
          href="/"
          className={cn(
            "block rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          系统状态
        </Link>
        {isAdmin && (
          <>
            <Link
              href="/settings/endpoints"
              className={cn(
                "block rounded-md px-3 py-2 text-sm transition-colors",
                pathname.startsWith("/settings/endpoints")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              端点设置
            </Link>
            <Link
              href="/settings/users"
              className={cn(
                "block rounded-md px-3 py-2 text-sm transition-colors",
                pathname.startsWith("/settings/users")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              用户管理
            </Link>
          </>
        )}
      </div>
      {userMenu}
    </aside>
  );
}
