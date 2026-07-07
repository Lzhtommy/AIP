"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const OAUTH_LABEL: Record<string, string> = {
  google: "使用 Google 登录",
  github: "使用 GitHub 登录",
};

function LoginForm() {
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((providers: Record<string, { id: string }>) => {
        setOauthProviders(
          Object.keys(providers).filter((id) => id in OAUTH_LABEL),
        );
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("邮箱或密码错误");
      setPending(false);
      return;
    }
    window.location.href = callbackUrl;
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>登录 AIP Console</CardTitle>
        <CardDescription>内部私有化 AgentOS 控制台</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-muted-foreground">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "登录中…" : "登录"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            没有账号？{" "}
            <Link href="/register" className="text-foreground underline">
              注册
            </Link>
          </p>
        </form>
        {oauthProviders.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {oauthProviders.map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(id, { callbackUrl })}
              >
                {OAUTH_LABEL[id]}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
