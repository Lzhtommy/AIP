import { describe, expect, it } from "vitest";
import {
  initialChatState,
  reduceChatEvent,
  startUserTurn,
  type ChatState,
} from "@/lib/chat/reducer";

function play(state: ChatState, events: Array<Record<string, unknown>>): ChatState {
  return events.reduce((s, e) => reduceChatEvent(s, e), state);
}

const RUN_STARTED = { event: "RunStarted", run_id: "run-1", session_id: "sess-1" };

describe("chat 归约层：SSE 事件 → 消息状态树", () => {
  it("用户发言后进入 streaming 状态并追加用户消息", () => {
    const s = startUserTurn(initialChatState, "你好");
    expect(s.status).toBe("streaming");
    expect(s.messages.filter((m) => m.role === "user").at(-1)).toMatchObject({
      text: "你好",
    });
  });

  it("RunStarted 记录 sessionId，RunContent 增量累积助手文本", () => {
    let s = startUserTurn(initialChatState, "你好");
    s = play(s, [
      RUN_STARTED,
      { event: "RunContent", content: "你" },
      { event: "RunContent", content: "好呀" },
    ]);
    expect(s.sessionId).toBe("sess-1");
    const last = s.messages.at(-1)!;
    expect(last.role).toBe("assistant");
    expect(last.text).toBe("你好呀");
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
    expect(s.messages.at(-1)!.text).toBe("完");
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
    expect(s.messages.at(-1)!.text).toBe("部分");
  });

  it("未知事件被忽略，不破坏状态", () => {
    let s = startUserTurn(initialChatState, "你好");
    s = play(s, [RUN_STARTED, { event: "SomethingNew", foo: 1 }, { event: "RunContent", content: "ok" }]);
    expect(s.messages.at(-1)!.text).toBe("ok");
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
    expect(s.messages.at(-1)!.text).toBe("回答二");
  });
});
