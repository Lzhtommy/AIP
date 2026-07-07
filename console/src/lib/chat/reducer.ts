/**
 * Chat 归约层：把 AgentOS 的 SSE 事件序列归约为消息状态树。
 * 纯函数、与渲染解耦；后续切片（工具调用、Team/Workflow）只增节点类型。
 */

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
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

/** 用户发出一条消息：追加用户消息 + 空的助手消息占位，进入 streaming */
export function startUserTurn(state: ChatState, text: string): ChatState {
  return {
    ...state,
    status: "streaming",
    error: null,
    messages: [
      ...state.messages,
      { role: "user", text },
      { role: "assistant", text: "" },
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

export function reduceChatEvent(
  state: ChatState,
  raw: Record<string, unknown>,
): ChatState {
  const event = String(raw.event ?? "");
  switch (event) {
    case "RunStarted": {
      const sessionId = typeof raw.session_id === "string" ? raw.session_id : state.sessionId;
      return { ...state, sessionId };
    }
    case "RunContent": {
      const delta = typeof raw.content === "string" ? raw.content : "";
      if (!delta) return state;
      return patchLastAssistant(state, (m) => ({ ...m, text: m.text + delta }));
    }
    case "RunCompleted":
      return { ...state, status: "idle" };
    case "RunError": {
      const message = typeof raw.content === "string" && raw.content ? raw.content : "运行失败";
      return { ...state, status: "error", error: message };
    }
    default:
      return state;
  }
}
