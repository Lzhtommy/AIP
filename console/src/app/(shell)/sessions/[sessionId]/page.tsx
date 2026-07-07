"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MessageBubble } from "@/components/chat-messages";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat/reducer";

interface SessionDetail {
  sessionId: string;
  name: string | null;
  userId: string | null;
  target: { kind: string; id: string | null };
  messages: ChatMessage[];
}

function SessionDetailInner() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearchParams();
  const kind = search.get("kind") ?? "agents";
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/os/sessions/${encodeURIComponent(params.sessionId)}?kind=${kind}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "会话不存在");
        }
        setDetail(await res.json());
      })
      .catch((e: Error) => setError(e.message));
  }, [params.sessionId, kind]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/sessions" className="text-sm underline">
          返回会话列表
        </Link>
      </div>
    );
  }
  if (!detail) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  const continueHref = detail.target.id
    ? `/chat?kind=${detail.target.kind}&id=${encodeURIComponent(detail.target.id)}&session=${encodeURIComponent(detail.sessionId)}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">
            {detail.name ?? detail.sessionId}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {detail.target.id && <Badge variant="outline">{detail.target.id}</Badge>}
            <span>会话 ID：{detail.sessionId}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/sessions"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            返回列表
          </Link>
          {continueHref && (
            <Link href={continueHref} className={buttonVariants({ size: "sm" })}>
              继续对话
            </Link>
          )}
        </div>
      </div>

      <div
        className="space-y-4 rounded-md border border-border p-4"
        data-testid="replay-list"
      >
        {detail.messages.length === 0 && (
          <p className="text-sm text-muted-foreground">该会话还没有消息记录。</p>
        )}
        {detail.messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </div>
    </div>
  );
}

export default function SessionDetailPage() {
  return (
    <Suspense>
      <SessionDetailInner />
    </Suspense>
  );
}
