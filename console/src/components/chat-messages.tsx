"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallCard } from "@/components/tool-call-card";
import { Badge } from "@/components/ui/badge";
import { messageText, type ChatMessage } from "@/lib/chat/reducer";
import { cn } from "@/lib/utils";

/** 助手消息的 parts 渲染：实时对话与会话回放共用，保证两处观感一致 */
export function AssistantParts({ message }: { message: ChatMessage }) {
  return (
    <>
      {message.parts.map((p, i) => {
        switch (p.type) {
          case "text":
            return (
              <div
                key={i}
                className="prose prose-sm prose-invert max-w-none [&_pre]:overflow-x-auto"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.text}</ReactMarkdown>
              </div>
            );
          case "tool":
            return <ToolCallCard key={p.id + i} part={p} />;
          case "member":
            return (
              <div
                key={i}
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"
                data-testid="member-marker"
              >
                <span>👤</span>
                <span className="font-medium">{p.name}</span>
              </div>
            );
          case "step":
            return (
              <div
                key={i}
                className="my-2 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                data-testid="step-marker"
              >
                <span className="text-muted-foreground">▸</span>
                <span>{p.name}</span>
                <Badge
                  variant={
                    p.status === "running"
                      ? "outline"
                      : p.status === "done"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {p.status === "running" ? "进行中…" : p.status === "done" ? "完成" : "失败"}
                </Badge>
              </div>
            );
        }
      })}
      {message.parts.length === 0 && <span>…</span>}
      {message.interrupted && (
        <p className="mt-1 text-xs text-muted-foreground">（已中断）</p>
      )}
    </>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div
      className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2 text-sm",
          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {message.role === "assistant" ? (
          <AssistantParts message={message} />
        ) : (
          messageText(message)
        )}
      </div>
    </div>
  );
}
