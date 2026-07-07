"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  initialChatState,
  messageText,
  reduceChatEvent,
  startUserTurn,
  type ChatMessage,
  type ChatState,
} from "@/lib/chat/reducer";
import { parseSseStream } from "@/lib/chat/sse";
import { cn } from "@/lib/utils";

type TargetKind = "agents" | "teams" | "workflows";

interface TargetItem {
  kind: TargetKind;
  id: string;
  name: string;
  description?: string;
  model?: { provider?: string; model?: string };
}

const KIND_LABEL: Record<TargetKind, string> = {
  agents: "Agents",
  teams: "Teams",
  workflows: "Workflows",
};

function ChatPageInner() {
  const search = useSearchParams();
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [target, setTarget] = useState<TargetItem | null>(null);
  const [chat, setChat] = useState<ChatState>(initialChatState);
  const [input, setInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 代际计数：新会话/切换 Agent 后，旧流的迟到更新一律丢弃
  const genRef = useRef(0);

  useEffect(() => {
    async function loadAll() {
      const kinds: TargetKind[] = ["agents", "teams", "workflows"];
      const results = await Promise.all(
        kinds.map(async (kind) => {
          const res = await fetch(`/api/os/${kind}`);
          if (!res.ok) {
            if (kind === "agents") {
              const body = await res.json().catch(() => null);
              throw new Error(body?.error?.message ?? "无法获取运行目标列表");
            }
            return [] as TargetItem[];
          }
          const list = (await res.json()) as Omit<TargetItem, "kind">[];
          return list.map((item) => ({ ...item, kind }));
        }),
      );
      const flat = results.flat();
      setTargets(flat);
      const wantKind = search.get("kind");
      const wantId = search.get("id");
      const preferred = flat.find((t) => t.kind === wantKind && t.id === wantId);
      setTarget((prev) => prev ?? preferred ?? flat[0] ?? null);

      // 从 Sessions 页续聊：预载历史消息并接上 sessionId
      const sessionId = search.get("session");
      if (preferred && sessionId) {
        const res = await fetch(
          `/api/os/sessions/${encodeURIComponent(sessionId)}?kind=${preferred.kind}`,
        );
        if (res.ok) {
          const detail = await res.json();
          setChat({
            messages: detail.messages ?? [],
            sessionId,
            status: "idle",
            error: null,
          });
        }
      }
    }
    loadAll().catch((e: Error) => setLoadError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  async function run(message: string) {
    if (!target) return;
    const gen = genRef.current;
    const commit = (s: ChatState) => {
      if (genRef.current === gen) setChat(s);
    };
    let state = startUserTurn(chat, message);
    commit(state);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/os/${target.kind}/${encodeURIComponent(target.id)}/runs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, sessionId: state.sessionId }),
          signal: controller.signal,
        },
      );
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        state = reduceChatEvent(state, {
          event: "RunError",
          content: body?.error?.message ?? `请求失败（${res.status}）`,
        });
        commit(state);
        return;
      }
      for await (const event of parseSseStream(res.body)) {
        state = reduceChatEvent(state, event);
        commit(state);
      }
      if (state.status === "streaming") {
        state = reduceChatEvent(state, { event: "RunCompleted" });
        commit(state);
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      state = reduceChatEvent(
        state,
        aborted ? { event: "__aborted" } : { event: "RunError", content: "连接中断" },
      );
      commit(state);
    } finally {
      abortRef.current = null;
    }
  }

  function send() {
    const message = input.trim();
    if (!message || chat.status === "streaming") return;
    setInput("");
    void run(message);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function retry() {
    const lastUser = chat.messages.filter((m) => m.role === "user").at(-1);
    if (lastUser) void run(messageText(lastUser));
  }

  function newSession() {
    genRef.current++;
    abortRef.current?.abort();
    setChat(initialChatState);
  }

  
  const streaming = chat.status === "streaming";

  return (
    <div className="flex h-full gap-6">
      <aside className="w-56 shrink-0 space-y-4 overflow-y-auto">
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {(["agents", "teams", "workflows"] as TargetKind[]).map((kind) => {
          const group = targets.filter((t) => t.kind === kind);
          if (group.length === 0) return null;
          return (
            <div key={kind} className="space-y-1">
              <h2 className="mb-1 text-sm font-medium text-muted-foreground">
                {KIND_LABEL[kind]}
              </h2>
              {group.map((t) => (
                <button
                  key={t.kind + t.id}
                  onClick={() => {
                    setTarget(t);
                    newSession();
                  }}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    target?.kind === t.kind && target?.id === t.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <div className="font-medium">{t.name}</div>
                  {(t.model?.model ?? t.description) && (
                    <div className="truncate text-xs text-muted-foreground">
                      {t.model?.model ?? t.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{target?.name ?? "Chat"}</h1>
            {chat.sessionId && <Badge variant="outline">会话中</Badge>}
          </div>
          <Button variant="outline" size="sm" onClick={newSession}>
            新会话
          </Button>
        </div>

        <div
          className="flex-1 space-y-4 overflow-y-auto rounded-md border border-border p-4"
          data-testid="message-list"
        >
          {chat.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              选择左侧 Agent，输入消息开始对话。
            </p>
          )}
          {chat.messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {chat.status === "error" && (
            <div className="flex items-center gap-3">
              <p role="alert" className="text-sm text-destructive">
                {chat.error}
              </p>
              <Button variant="outline" size="sm" onClick={retry}>
                重试
              </Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={target ? "输入消息…" : "暂无可用运行目标"}
            disabled={!target || streaming}
            aria-label="消息输入"
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {streaming ? (
            <Button type="button" variant="destructive" onClick={stop}>
              停止
            </Button>
          ) : (
            <Button type="submit" disabled={!target}>
              发送
            </Button>
          )}
        </form>
      </section>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}
