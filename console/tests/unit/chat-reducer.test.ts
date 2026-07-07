import { describe, expect, it } from "vitest";
import {
  initialChatState,
  messageText,
  reduceChatEvent,
  startUserTurn,
  type ChatMessage,
  type ChatState,
} from "@/lib/chat/reducer";

function play(state: ChatState, events: Array<Record<string, unknown>>): ChatState {
  return events.reduce((s, e) => reduceChatEvent(s, e), state);
}

function lastAssistant(s: ChatState): ChatMessage {
  return s.messages.filter((m) => m.role === "assistant").at(-1)!;
}

const RUN_STARTED = { event: "RunStarted", run_id: "run-1", session_id: "sess-1" };

describe("chat 归约层：SSE 事件 → 消息状态树", () => {
  it("用户发言后进入 streaming 状态并追加用户消息", () => {
    const s = startUserTurn(initialChatState, "你好");
    expect(s.status).toBe("streaming");
    const lastUser = s.messages.filter((m) => m.role === "user").at(-1)!;
    expect(messageText(lastUser)).toBe("你好");
  });

  it("RunStarted 记录 sessionId，RunContent 增量累积助手文本", () => {
    let s = startUserTurn(initialChatState, "你好");
    s = play(s, [
      RUN_STARTED,
      { event: "RunContent", content: "你" },
      { event: "RunContent", content: "好呀" },
    ]);
    expect(s.sessionId).toBe("sess-1");
    const last = lastAssistant(s);
    expect(messageText(last)).toBe("你好呀");
    expect(s.status).toBe("streaming");
  });

  it("RunCompleted 结束流式状态", () => {
    let s = startUserTurn(initialChatState, "你好");
    s = play(s, [
      RUN_STARTED,
      { event: "RunContent", content: "完" },
      { event: "RunCompleted", content: "完" },
    ]);
    expect(s.status).toBe("idle");
    expect(messageText(lastAssistant(s))).toBe("完");
  });

  it("RunError 标记错误并保留已有内容", () => {
    let s = startUserTurn(initialChatState, "你好");
    s = play(s, [
      RUN_STARTED,
      { event: "RunContent", content: "部分" },
      { event: "RunError", content: "模型超时" },
    ]);
    expect(s.status).toBe("error");
    expect(s.error).toBe("模型超时");
    expect(messageText(lastAssistant(s))).toBe("部分");
  });

  it("未知事件被忽略，不破坏状态", () => {
    let s = startUserTurn(initialChatState, "你好");
    s = play(s, [RUN_STARTED, { event: "SomethingNew", foo: 1 }, { event: "RunContent", content: "ok" }]);
    expect(messageText(lastAssistant(s))).toBe("ok");
    expect(s.status).toBe("streaming");
  });

  it("多轮对话：第二轮沿用 sessionId 并追加新消息对", () => {
    let s = startUserTurn(initialChatState, "第一轮");
    s = play(s, [RUN_STARTED, { event: "RunContent", content: "回答一" }, { event: "RunCompleted" }]);
    s = startUserTurn(s, "第二轮");
    s = play(s, [
      { event: "RunStarted", run_id: "run-2", session_id: "sess-1" },
      { event: "RunContent", content: "回答二" },
      { event: "RunCompleted" },
    ]);
    expect(s.messages).toHaveLength(4);
    expect(s.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(messageText(lastAssistant(s))).toBe("回答二");
  });

  it("工具调用：Started 生成 running 工具节点，Completed 填入结果", () => {
    let s = startUserTurn(initialChatState, "算一下 137*73");
    s = play(s, [
      RUN_STARTED,
      {
        event: "ToolCallStarted",
        tool: { tool_call_id: "tc-1", tool_name: "multiply", tool_args: { a: 137, b: 73 } },
      },
      {
        event: "ToolCallCompleted",
        tool: { tool_call_id: "tc-1", tool_name: "multiply", result: "10001" },
      },
      { event: "RunContent", content: "结果是 10001" },
      { event: "RunCompleted" },
    ]);
    const parts = lastAssistant(s).parts;
    const tool = parts.find((p) => p.type === "tool")!;
    expect(tool).toMatchObject({
      type: "tool",
      name: "multiply",
      status: "done",
      result: "10001",
    });
    expect(tool.type === "tool" && tool.args).toEqual({ a: 137, b: 73 });
    // 工具节点在后续文本之前，顺序保留
    expect(parts.at(-1)).toMatchObject({ type: "text", text: "结果是 10001" });
  });

  it("文本-工具-文本交错时各 part 顺序正确", () => {
    let s = startUserTurn(initialChatState, "hi");
    s = play(s, [
      RUN_STARTED,
      { event: "RunContent", content: "我先查一下。" },
      { event: "ToolCallStarted", tool: { tool_call_id: "tc-2", tool_name: "search" } },
      { event: "ToolCallCompleted", tool: { tool_call_id: "tc-2", tool_name: "search", result: "ok" } },
      { event: "RunContent", content: "查到了。" },
    ]);
    expect(lastAssistant(s).parts.map((p) => p.type)).toEqual([
      "text",
      "tool",
      "text",
    ]);
  });

  it("interruptRun 立即结束 streaming 并标注中断", () => {
    let s = startUserTurn(initialChatState, "长任务");
    s = play(s, [RUN_STARTED, { event: "RunContent", content: "写到一半" }]);
    s = reduceChatEvent(s, { event: "__aborted" });
    expect(s.status).toBe("idle");
    expect(messageText(lastAssistant(s))).toContain("写到一半");
    expect(lastAssistant(s).interrupted).toBe(true);
  });
});
