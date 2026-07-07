"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  initialChatState,
  reduceChatEvent,
  startUserTurn,
  type ChatState,
} from "@/lib/chat/reducer";
import { parseSseStream } from "@/lib/chat/sse";
import { cn } from "@/lib/utils";

interface AgentItem {
  id: string;
  name: string;
  model?: { provider?: string; model?: string };
}

export default function ChatPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatState>(initialChatState);
  const [input, setInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/os/agents")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "无法获取 Agent 列表");
        }
        return res.json();
      })
      .then((list: AgentItem[]) => {
        setAgents(list);
        setAgentId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  async function send() {
    const message = input.trim();
    if (!message || !agentId || chat.status === "streaming") return;
    setInput("");
    let state = startUserTurn(chat, message);
    setChat(state);

    try {
      const res = await fetch(
        `/api/os/agents/${encodeURIComponent(agentId)}/runs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, sessionId: state.sessionId }),
        },
      );
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        state = reduceChatEvent(state, {
          event: "RunError",
          content: body?.error?.message ?? `请求失败（${res.status}）`,
        });
        setChat(state);
        return;
      }
      for await (const event of parseSseStream(res.body)) {
        state = reduceChatEvent(state, event);
        setChat(state);
      }
      // 流正常结束但没收到 RunCompleted 时兜底收尾
      if (state.status === "streaming") {
        state = reduceChatEvent(state, { event: "RunCompleted" });
        setChat(state);
      }
    } catch {
      state = reduceChatEvent(state, { event: "RunError", content: "连接中断" });
      setChat(state);
    }
  }

  function newSession() {
    setChat(initialChatState);
  }

  const currentAgent = agents.find((a) => a.id === agentId);

  return (
    <div className="flex h-full gap-6">
      <aside className="w-56 shrink-0 space-y-1">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Agents</h2>
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              setAgentId(a.id);
              newSession();
            }}
            className={cn(
              "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
              a.id === agentId
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <div className="font-medium">{a.name}</div>
            {a.model?.model && (
              <div className="text-xs text-muted-foreground">{a.model.model}</div>
            )}
          </button>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{currentAgent?.name ?? "Chat"}</h1>
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
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_pre]:overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.text || "…"}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
          {chat.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {chat.error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={agentId ? "输入消息…" : "暂无可用 Agent"}
            disabled={!agentId || chat.status === "streaming"}
            aria-label="消息输入"
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={!agentId || chat.status === "streaming"}>
            {chat.status === "streaming" ? "生成中…" : "发送"}
          </Button>
        </form>
      </section>
    </div>
  );
}
