"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallCard } from "@/components/tool-call-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { messageText, type ChatMessage } from "@/lib/chat/reducer";
import { cn } from "@/lib/utils";

/** 助手消息的 parts 渲染：实时对话与会话回放共用，保证两处观感一致。
 *  onConfirm 存在时，pending 的审批卡片显示批准/拒绝按钮。 */
export function AssistantParts({
  message,
  onConfirm,
}: {
  message: ChatMessage;
  onConfirm?: (toolCallId: string, approved: boolean) => void;
}) {
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
          case "confirmation":
            return (
              <div
                key={i}
                className="my-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                data-testid="confirmation-card"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="font-medium">工具审批：{p.name}</span>
                  {p.status === "approved" && <Badge variant="secondary">已批准</Badge>}
                  {p.status === "rejected" && <Badge variant="destructive">已拒绝</Badge>}
                </div>
                {p.args && (
                  <pre className="mb-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(p.args, null, 2)}
                  </pre>
                )}
                {p.status === "pending" && onConfirm && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onConfirm(p.toolCallId, true)}>
                      批准
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onConfirm(p.toolCallId, false)}
                    >
                      拒绝
                    </Button>
                  </div>
                )}
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

/** 用户消息：图片缩略图 + 文本 */
function UserParts({ message }: { message: ChatMessage }) {
  const images = message.parts.filter((p) => p.type === "image");
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((p, i) =>
            p.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt={p.name ?? "图片"}
                className="max-h-32 rounded-md border border-border"
                data-testid="chat-image"
              />
            ) : null,
          )}
        </div>
      )}
      {messageText(message) && <div>{messageText(message)}</div>}
    </div>
  );
}

export function MessageBubble({
  message,
  onConfirm,
}: {
  message: ChatMessage;
  onConfirm?: (toolCallId: string, approved: boolean) => void;
}) {
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
          <AssistantParts message={message} onConfirm={onConfirm} />
        ) : (
          <UserParts message={message} />
        )}
      </div>
    </div>
  );
}
