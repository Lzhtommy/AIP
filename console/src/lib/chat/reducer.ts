/**
 * Chat 归约层：把 AgentOS 的 SSE 事件序列归约为消息状态树。
 * 纯函数、与渲染解耦。消息由有序 parts 组成：文本与工具调用节点交错，
 * 后续切片（Team/Workflow）只增节点类型。
 */

export interface TextPart {
  type: "text";
  text: string;
  /** Team 场景下该文本段归属的成员；团队级汇总为 undefined */
  memberId?: string;
}

export interface ToolPart {
  type: "tool";
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: "running" | "done" | "error";
}

/** Team 成员分工标记：其后的产出归属该成员，直到下一个标记 */
export interface MemberPart {
  type: "member";
  id: string;
  name: string;
}

/** Workflow 步骤节点 */
export interface StepPart {
  type: "step";
  name: string;
  status: "running" | "done" | "error";
}

/** 图片附件（用户消息中的缩略图；data URL 或 http URL） */
export interface ImagePart {
  type: "image";
  url: string;
  name?: string;
}

export type MessagePart = TextPart | ToolPart | MemberPart | StepPart | ImagePart;

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

/** 用户发出一条消息：追加用户消息（可含图片）+ 空的助手消息占位，进入 streaming */
export function startUserTurn(
  state: ChatState,
  text: string,
  images: Array<{ url: string; name?: string }> = [],
): ChatState {
  const parts: MessagePart[] = [
    ...images.map((img) => ({ type: "image" as const, url: img.url, name: img.name })),
    { type: "text" as const, text },
  ];
  return {
    ...state,
    status: "streaming",
    error: null,
    messages: [
      ...state.messages,
      { role: "user", parts },
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

function appendText(m: ChatMessage, delta: string, memberId?: string): ChatMessage {
  const parts = [...m.parts];
  const last = parts.at(-1);
  if (last?.type === "text" && last.memberId === memberId) {
    parts[parts.length - 1] = { ...last, text: last.text + delta };
  } else {
    parts.push({ type: "text", text: delta, memberId });
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

/** 事件带 agent 归属（Team 成员活动）时，确保当前成员标记已插入 */
function ensureMemberMarker(
  state: ChatState,
  raw: Record<string, unknown>,
): ChatState {
  const agentId = typeof raw.agent_id === "string" ? raw.agent_id : null;
  if (!agentId) return state;
  const name =
    typeof raw.agent_name === "string" && raw.agent_name ? raw.agent_name : agentId;
  return patchLastAssistant(state, (m) => {
    const lastMember = m.parts.filter((p): p is MemberPart => p.type === "member").at(-1);
    if (lastMember?.id === agentId) return m;
    return { ...m, parts: [...m.parts, { type: "member", id: agentId, name }] };
  });
}

/** Team* 前缀事件与 Agent 事件同构：统一去前缀后处理 */
function normalizeEventName(event: string): string {
  if (event.startsWith("Team")) return event.slice(4);
  if (event === "WorkflowStarted") return "RunStarted";
  if (event === "WorkflowCompleted") return "RunCompleted";
  if (event === "WorkflowError") return "RunError";
  return event;
}

export function reduceChatEvent(
  state: ChatState,
  raw: Record<string, unknown>,
): ChatState {
  const event = normalizeEventName(String(raw.event ?? ""));
  state = ensureMemberMarker(state, raw);
  switch (event) {
    case "RunStarted": {
      const sessionId =
        typeof raw.session_id === "string" ? raw.session_id : state.sessionId;
      return { ...state, sessionId };
    }
    case "RunContent": {
      const delta = typeof raw.content === "string" ? raw.content : "";
      if (!delta) return state;
      const memberId = typeof raw.agent_id === "string" ? raw.agent_id : undefined;
      return patchLastAssistant(state, (m) => appendText(m, delta, memberId));
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
    case "StepStarted": {
      const name =
        typeof raw.step_name === "string" && raw.step_name ? raw.step_name : "步骤";
      return patchLastAssistant(state, (m) => ({
        ...m,
        parts: [...m.parts, { type: "step", name, status: "running" }],
      }));
    }
    case "StepCompleted":
    case "StepError": {
      const failed = event === "StepError";
      const name = typeof raw.step_name === "string" ? raw.step_name : null;
      return patchLastAssistant(state, (m) => {
        const parts = [...m.parts];
        let idx = name
          ? parts.findLastIndex((p) => p.type === "step" && p.name === name)
          : -1;
        if (idx === -1) {
          idx = parts.findLastIndex((p) => p.type === "step" && p.status === "running");
        }
        if (idx === -1) return m;
        parts[idx] = {
          ...(parts[idx] as StepPart),
          status: failed ? "error" : "done",
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
