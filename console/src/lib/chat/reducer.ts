/**
 * Chat 归约层：把 AgentOS 的 SSE 事件序列归约为消息状态树。
 * 纯函数、与渲染解耦。消息由有序 parts 组成：文本与工具调用节点交错，
 * 后续切片（Team/Workflow）只增节点类型。
 */

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolPart {
  type: "tool";
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: "running" | "done" | "error";
}

export type MessagePart = TextPart | ToolPart;

export interface ChatMessage {
  role: "user" | "assistant";
  parts: MessagePart[];
  interrupted?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  status: "idle" | "streaming" | "error";
  error: string | null;
}

export const initialChatState: ChatState = {
  messages: [],
  sessionId: null,
  status: "idle",
  error: null,
};

/** 派生消息纯文本（测试与预览用） */
export function messageText(m: ChatMessage): string {
  return m.parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** 用户发出一条消息：追加用户消息 + 空的助手消息占位，进入 streaming */
export function startUserTurn(state: ChatState, text: string): ChatState {
  return {
    ...state,
    status: "streaming",
    error: null,
    messages: [
      ...state.messages,
      { role: "user", parts: [{ type: "text", text }] },
      { role: "assistant", parts: [] },
    ],
  };
}

function patchLastAssistant(
  state: ChatState,
  patch: (m: ChatMessage) => ChatMessage,
): ChatState {
  const messages = [...state.messages];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      messages[i] = patch(messages[i]);
      break;
    }
  }
  return { ...state, messages };
}

function appendText(m: ChatMessage, delta: string): ChatMessage {
  const parts = [...m.parts];
  const last = parts.at(-1);
  if (last?.type === "text") {
    parts[parts.length - 1] = { ...last, text: last.text + delta };
  } else {
    parts.push({ type: "text", text: delta });
  }
  return { ...m, parts };
}

interface RawTool {
  tool_call_id?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  result?: unknown;
}

function toolFromEvent(raw: Record<string, unknown>): RawTool {
  return (raw.tool ?? {}) as RawTool;
}

export function reduceChatEvent(
  state: ChatState,
  raw: Record<string, unknown>,
): ChatState {
  const event = String(raw.event ?? "");
  switch (event) {
    case "RunStarted": {
      const sessionId =
        typeof raw.session_id === "string" ? raw.session_id : state.sessionId;
      return { ...state, sessionId };
    }
    case "RunContent": {
      const delta = typeof raw.content === "string" ? raw.content : "";
      if (!delta) return state;
      return patchLastAssistant(state, (m) => appendText(m, delta));
    }
    case "ToolCallStarted": {
      const tool = toolFromEvent(raw);
      return patchLastAssistant(state, (m) => ({
        ...m,
        parts: [
          ...m.parts,
          {
            type: "tool",
            id: tool.tool_call_id ?? `tool-${m.parts.length}`,
            name: tool.tool_name ?? "unknown",
            args: tool.tool_args,
            status: "running",
          },
        ],
      }));
    }
    case "ToolCallCompleted":
    case "ToolCallError": {
      const tool = toolFromEvent(raw);
      const failed = event === "ToolCallError";
      return patchLastAssistant(state, (m) => {
        const parts = [...m.parts];
        // 按 tool_call_id 匹配；找不到则匹配最后一个 running 的工具节点
        let idx = parts.findIndex(
          (p) => p.type === "tool" && tool.tool_call_id && p.id === tool.tool_call_id,
        );
        if (idx === -1) {
          idx = parts.findLastIndex(
            (p) => p.type === "tool" && p.status === "running",
          );
        }
        if (idx === -1) return m;
        const prev = parts[idx] as ToolPart;
        parts[idx] = {
          ...prev,
          status: failed ? "error" : "done",
          result:
            tool.result === undefined ? prev.result : String(tool.result),
        };
        return { ...m, parts };
      });
    }
    case "RunCompleted":
      return { ...state, status: "idle" };
    case "RunError": {
      const message =
        typeof raw.content === "string" && raw.content ? raw.content : "运行失败";
      return { ...state, status: "error", error: message };
    }
    // 内部事件：用户点击 stop / 连接被中断
    case "__aborted":
      return patchLastAssistant(
        { ...state, status: "idle" },
        (m) => ({ ...m, interrupted: true }),
      );
    default:
      return state;
  }
}
